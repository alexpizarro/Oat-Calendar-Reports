import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { queryCalendarPopularity } from '@/lib/analytics/queries';

const QuerySchema = z.object({ from: z.string(), to: z.string() });

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { id: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const q = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = QuerySchema.safeParse(q);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });

  const data = await queryCalendarPopularity(id, new Date(parsed.data.from), new Date(parsed.data.to));
  return NextResponse.json(data);
}
