import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GHLClient } from '@/lib/ghl/client';
import { listCalendars } from '@/lib/ghl/calendars';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { id: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Return calendars from DB (already synced)
  const calendars = await prisma.calendar.findMany({
    where: { location_id: id },
    select: { id: true, ghl_id: true, name: true, is_active: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(calendars);
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { id: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch from GHL and upsert
  const client = new GHLClient(id);
  let ghlCalendars;
  try {
    ghlCalendars = await listCalendars(client);
  } catch (err) {
    console.error('[calendars] GHL fetch failed:', err);
    return NextResponse.json({ error: 'Failed to fetch calendars from GHL' }, { status: 502 });
  }

  for (const cal of ghlCalendars) {
    await prisma.calendar.upsert({
      where: { location_id_ghl_id: { location_id: id, ghl_id: cal.id } },
      update: { name: cal.name, raw_json: JSON.stringify(cal) },
      create: {
        location_id: id,
        ghl_id: cal.id,
        name: cal.name,
        is_active: cal.isActive !== false,
        raw_json: JSON.stringify(cal),
      },
    });
  }

  const calendars = await prisma.calendar.findMany({
    where: { location_id: id },
    select: { id: true, ghl_id: true, name: true, is_active: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(calendars);
}
