import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { CreateCohortSchema } from '@/types/api';

// Cohorts are stored in Location.settings_json under "cohorts" key
// Simple in-memory-style storage using JSON in settings

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await prisma.location.findUnique({
    where: { id },
    select: { settings_json: true },
  });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const settings = location.settings_json ? JSON.parse(location.settings_json) : {};
  return NextResponse.json(settings.cohorts ?? []);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await prisma.location.findUnique({
    where: { id },
    select: { settings_json: true },
  });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = CreateCohortSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const settings = location.settings_json ? JSON.parse(location.settings_json) : {};
  const cohorts = settings.cohorts ?? [];

  const newCohort = {
    id: `cohort_${Date.now()}`,
    ...parsed.data,
    createdAt: new Date().toISOString(),
  };
  cohorts.push(newCohort);
  settings.cohorts = cohorts;

  await prisma.location.update({
    where: { id },
    data: { settings_json: JSON.stringify(settings) },
  });

  return NextResponse.json(newCohort, { status: 201 });
}
