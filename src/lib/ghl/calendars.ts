import type { GHLClient } from './client';
import type { GHLCalendar, GHLCalendarsResponse } from './types';

export async function listCalendars(
  client: GHLClient,
): Promise<GHLCalendar[]> {
  const res = await client.get<GHLCalendarsResponse>('/calendars/', {});
  return res.calendars ?? [];
}
