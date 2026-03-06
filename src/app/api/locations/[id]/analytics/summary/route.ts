import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { querySummary } from '@/lib/analytics/queries';

const QuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  calendarIds: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { id: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const q = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = QuerySchema.safeParse(q);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });

  const { from, to, calendarIds } = parsed.data;
  const calIds = calendarIds ? calendarIds.split(',').filter(Boolean) : undefined;

  const data = await querySummary(id, new Date(from), new Date(to), calIds);
  return NextResponse.json(data);
}
