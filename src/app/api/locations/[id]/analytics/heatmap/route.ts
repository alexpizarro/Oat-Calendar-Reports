import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { queryHeatmap } from '@/lib/analytics/queries';

const QuerySchema = z.object({
  from: z.string(),
  to: z.string(),
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

  const calIds = parsed.data.calendarIds?.split(',').filter(Boolean);
  const data = await queryHeatmap(id, new Date(parsed.data.from), new Date(parsed.data.to), location.timezone, calIds);
  return NextResponse.json(data);
}
