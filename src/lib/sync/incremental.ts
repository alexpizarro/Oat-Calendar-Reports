import prisma from '@/lib/prisma';
import { GHLClient } from '@/lib/ghl/client';
import { fetchEventsInWindow } from '@/lib/ghl/events';
import { enrichContacts } from './contact-enrichment';
import { normalizeStatus, getStatusMappings } from '@/lib/status-mapping';
import { parseLocationSettings } from '@/lib/status-mapping';
import type { GHLCalendarEvent } from '@/lib/ghl/types';

export interface IncrementalPayload {
  locationId: string;
}

export async function runIncremental(payload: IncrementalPayload): Promise<void> {
  const { locationId } = payload;
  const client = new GHLClient(locationId);

  const location = await prisma.location.findUniqueOrThrow({
    where: { id: locationId },
    select: { settings_json: true },
  });

  const settings = parseLocationSettings(location.settings_json);
  const statusMappings = settings.statusMappings;
  const windowDays = settings.incrementalWindowDays;

  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const calendars = await prisma.calendar.findMany({
    where: { location_id: locationId, is_active: true },
  });

  for (const calendar of calendars) {
    try {
      const events = await fetchEventsInWindow(
        client, calendar.ghl_id, fromDate, toDate,
      );

      await upsertEventsIncremental(events, locationId, calendar.id, statusMappings, client);
    } catch (err) {
      console.error(`[incremental] calendar ${calendar.id} failed:`, err);
    }
  }
}

async function upsertEventsIncremental(
  events: GHLCalendarEvent[],
  locationId: string,
  calendarId: string,
  statusMappings: Record<string, string>,
  client: GHLClient,
): Promise<void> {
  if (events.length === 0) return;

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
