import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const checkpoints = await prisma.syncCheckpoint.findMany({
    where: { location_id: id },
    orderBy: { window_start: 'desc' },
    take: 100,
    include: { calendar: { select: { name: true } } },
  });

  return NextResponse.json(
    checkpoints.map((cp: (typeof checkpoints)[number]) => ({
      id: cp.id,
      calendarId: cp.calendar_id,
      calendarName: cp.calendar.name,
      windowStart: cp.window_start,
      windowEnd: cp.window_end,
      lastSuccessAt: cp.last_success_at,
      lastError: cp.last_error,
      updatedAt: cp.updated_at,
    })),
  );
}
