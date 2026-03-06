import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseLocationSettings } from '@/lib/status-mapping';

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  timezone: z.string().optional(),
  ghlLocationId: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      timezone: true,
      auth_mode: true,
      connected_at: true,
      settings_json: true,
      ghl_location_id: true,
    },
  });

  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ...location,
    ghlLocationId: location.ghl_location_id,
    settings: parseLocationSettings(location.settings_json),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.timezone) updateData.timezone = parsed.data.timezone;
  if (parsed.data.ghlLocationId !== undefined) updateData.ghl_location_id = parsed.data.ghlLocationId;
  if (parsed.data.settings) updateData.settings_json = JSON.stringify(parsed.data.settings);

  const location = await prisma.location.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, timezone: true, settings_json: true },
  });

  return NextResponse.json({
    ...location,
    settings: parseLocationSettings(location.settings_json),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
