import type { GHLClient } from './client';
import type { GHLCalendarEvent, GHLEventsResponse } from './types';

const WINDOW_DAYS = 14;

export async function fetchEventsInWindow(
  client: GHLClient,
  calendarId: string,
  locationId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<GHLCalendarEvent[]> {
  const all: GHLCalendarEvent[] = [];
  let nextPageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      calendarId,
      locationId,
      startTime: windowStart.toISOString(),
      endTime: windowEnd.toISOString(),
    };
    if (nextPageToken) params['pageToken'] = nextPageToken;

    const res = await client.get<GHLEventsResponse>('/calendars/events', params);

    all.push(...(res.events ?? []));
    nextPageToken = res.meta?.nextPageToken;
  } while (nextPageToken);

  return all;
}

export async function fetchEventsInRange(
  client: GHLClient,
  calendarId: string,
  locationId: string,
  startDate: Date,
  endDate: Date,
  onWindow?: (events: GHLCalendarEvent[], windowStart: Date, windowEnd: Date) => Promise<void>,
): Promise<GHLCalendarEvent[]> {
  const all: GHLCalendarEvent[] = [];
  const windowMs = WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let windowStart = startDate;

  while (windowStart < endDate) {
    const windowEnd = new Date(Math.min(windowStart.getTime() + windowMs, endDate.getTime()));
    const events = await fetchEventsInWindow(client, calendarId, locationId, windowStart, windowEnd);

    if (onWindow) {
      await onWindow(events, windowStart, windowEnd);
    } else {
      all.push(...events);
    }

    windowStart = windowEnd;
  }

  return all;
}
