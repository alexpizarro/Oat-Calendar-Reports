import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { queryTrend } from '@/lib/analytics/queries';

const QuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  granularity: z.enum(['daily', 'weekly']).default('daily'),
  calendarIds: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const location = await prisma.location.findUnique({
    where: { id },
    select: { id: true, timezone: true },
  });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const q = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = QuerySchema.safeParse(q);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });

  const { from, to, granularity, calendarIds } = parsed.data;
  const calIds = calendarIds ? calendarIds.split(',').filter(Boolean) : undefined;

  const data = await queryTrend(id, new Date(from), new Date(to), location.timezone, granularity, calIds);
  return NextResponse.json(data);
}
