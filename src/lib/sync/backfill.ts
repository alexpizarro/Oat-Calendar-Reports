import prisma from '@/lib/prisma';
import { GHLClient } from '@/lib/ghl/client';
import { fetchEventsInWindow } from '@/lib/ghl/events';
import { enrichContacts } from './contact-enrichment';
import { markWindowSuccess, markWindowError, getCompletedWindowKeys } from './checkpoint';
import { normalizeStatus, getStatusMappings } from '@/lib/status-mapping';
import type { GHLCalendarEvent } from '@/lib/ghl/types';

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export interface BackfillPayload {
  locationId: string;
  fromDate: string;   // ISO
  toDate: string;     // ISO
  calendarIds?: string[];
}

export async function runBackfill(jobId: string, payload: BackfillPayload): Promise<void> {
  const { locationId, calendarIds } = payload;
  const fromDate = new Date(payload.fromDate);
  const toDate = new Date(payload.toDate);

  const client = new GHLClient(locationId);

  const location = await prisma.location.findUniqueOrThrow({
    where: { id: locationId },
    select: { settings_json: true },
  });
  const statusMappings = getStatusMappings(location.settings_json);

  // Resolve calendars to sync
  const calendars = calendarIds?.length
    ? await prisma.calendar.findMany({ where: { id: { in: calendarIds }, location_id: locationId } })
    : await prisma.calendar.findMany({ where: { location_id: locationId, is_active: true } });

  for (const calendar of calendars) {
    const completedKeys = await getCompletedWindowKeys(locationId, calendar.id, fromDate, toDate);
    let windowStart = fromDate;

    while (windowStart < toDate) {
      const windowEnd = new Date(Math.min(windowStart.getTime() + WINDOW_MS, toDate.getTime()));
      const windowKey = `${windowStart.toISOString()}|${windowEnd.toISOString()}`;

      if (completedKeys.has(windowKey)) {
        windowStart = windowEnd;
        continue;
      }

      try {
        const events = await fetchEventsInWindow(
          client, calendar.ghl_id, locationId, windowStart, windowEnd,
        );

        await upsertEvents(events, locationId, calendar.id, statusMappings, client);
        await markWindowSuccess(locationId, calendar.id, windowStart, windowEnd);
      } catch (err) {
        console.error(`[backfill] window ${windowKey} for calendar ${calendar.id} failed:`, err);
        await markWindowError(locationId, calendar.id, windowStart, windowEnd, err);
      }

      windowStart = windowEnd;
    }
  }
}

async function upsertEvents(
  events: GHLCalendarEvent[],
  locationId: string,
  calendarId: string,
  statusMappings: Record<string, string>,
  client: GHLClient,
): Promise<void> {
  if (events.length === 0) return;

  // Enrich contacts
  const contactGhlIds = [...new Set(events.map(e => e.contactId).filter((id): id is string => !!id))];
  const contactMap = await enrichContacts(client, locationId, contactGhlIds);

  for (const event of events) {
    if (!event.id) continue;

    const statusRaw = (event.appointmentStatus ?? event.status ?? '').toLowerCase();
    const statusNorm = normalizeStatus(statusRaw, statusMappings as Record<string, import('@/types/api').StatusNorm>);
    const contactInternalId = event.contactId ? (contactMap.get(event.contactId) ?? null) : null;

    await prisma.appointmentEvent.upsert({
      where: { ghl_event_id: event.id },
      update: {
        status_raw: statusRaw,
        status_norm: statusNorm,
        contact_id: contactInternalId,
        end_at: event.endTime ? new Date(event.endTime) : null,
        raw_json: JSON.stringify(event),
      },
      create: {
        ghl_event_id: event.id,
        location_id: locationId,
        calendar_id: calendarId,
        contact_id: contactInternalId,
        start_at: new Date(event.startTime ?? Date.now()),
        end_at: event.endTime ? new Date(event.endTime) : null,
        booked_at: event.dateAdded ? new Date(event.dateAdded) : null,
        status_raw: statusRaw,
        status_norm: statusNorm,
        raw_json: JSON.stringify(event),
      },
    });
  }
}
