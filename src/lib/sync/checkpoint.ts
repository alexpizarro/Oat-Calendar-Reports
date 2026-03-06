import prisma from '@/lib/prisma';

export async function markWindowSuccess(
  locationId: string,
  calendarId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<void> {
  await prisma.syncCheckpoint.upsert({
    where: {
      location_id_calendar_id_window_start: {
        location_id: locationId,
        calendar_id: calendarId,
        window_start: windowStart,
      },
    },
    update: {
      last_success_at: new Date(),
      last_error: null,
    },
    create: {
      location_id: locationId,
      calendar_id: calendarId,
      window_start: windowStart,
      window_end: windowEnd,
      last_success_at: new Date(),
    },
  });
}

export async function markWindowError(
  locationId: string,
  calendarId: string,
  windowStart: Date,
  windowEnd: Date,
  error: unknown,
): Promise<void> {
  const errorMsg = error instanceof Error ? error.message : String(error);
  await prisma.syncCheckpoint.upsert({
    where: {
      location_id_calendar_id_window_start: {
        location_id: locationId,
        calendar_id: calendarId,
        window_start: windowStart,
      },
    },
    update: { last_error: errorMsg },
    create: {
      location_id: locationId,
      calendar_id: calendarId,
      window_start: windowStart,
      window_end: windowEnd,
      last_error: errorMsg,
    },
  });
}

export async function getCompletedWindowKeys(
  locationId: string,
  calendarId: string,
  fromDate: Date,
  toDate: Date,
): Promise<Set<string>> {
  const rows = await prisma.syncCheckpoint.findMany({
    where: {
      location_id: locationId,
      calendar_id: calendarId,
      last_success_at: { not: null },
      window_start: { gte: fromDate },
      window_end: { lte: toDate },
    },
    select: { window_start: true, window_end: true },
  });

  return new Set(rows.map(r => `${r.window_start.toISOString()}|${r.window_end.toISOString()}`));
}
