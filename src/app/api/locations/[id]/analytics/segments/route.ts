import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { querySegmentation, queryContactsBySegment } from '@/lib/analytics/queries';

const QuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  field: z.string().default('email_domain'),
  calendarIds: z.string().optional(),
  // For drilldown: pass segmentValue to get contacts for that segment
  segmentValue: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await prisma.location.findUnique({ where: { id }, select: { id: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const q = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = QuerySchema.safeParse(q);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });

  const { from, to, field, calendarIds, segmentValue } = parsed.data;
  const calIds = calendarIds?.split(',').filter(Boolean);
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (segmentValue !== undefined) {
    // Drilldown mode
    const data = await queryContactsBySegment(id, fromDate, toDate, field, segmentValue, calIds);
    return NextResponse.json(data);
  }

  const data = await querySegmentation(id, fromDate, toDate, field, calIds);
  return NextResponse.json(data);
}
