import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type Params = { params: { id: string; cohortId: string } };

function getCohorts(settingsJson: string | null) {
  if (!settingsJson) return [];
  try {
    return JSON.parse(settingsJson).cohorts ?? [];
  } catch {
    return [];
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, cohortId } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { settings_json: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const cohort = getCohorts(location.settings_json).find((c: { id: string }) => c.id === cohortId);
  if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });

  return NextResponse.json(cohort);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, cohortId } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { settings_json: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const settings = location.settings_json ? JSON.parse(location.settings_json) : {};
  settings.cohorts = (settings.cohorts ?? []).filter((c: { id: string }) => c.id !== cohortId);

  await prisma.location.update({ where: { id }, data: { settings_json: JSON.stringify(settings) } });
  return NextResponse.json({ ok: true });
}
