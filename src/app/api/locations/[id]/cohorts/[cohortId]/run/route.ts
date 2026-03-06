import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { enqueueTagCohort } from '@/lib/jobs/enqueue';

type Params = { params: { id: string; cohortId: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, cohortId } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { settings_json: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const settings = location.settings_json ? JSON.parse(location.settings_json) : {};
  const cohort = (settings.cohorts ?? []).find((c: { id: string }) => c.id === cohortId);
  if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });

  const job = await enqueueTagCohort(id, {
    locationId: id,
    tagName: cohort.tagName,
    conflictTags: cohort.conflictTags ?? [],
    rule: cohort.rule,
  });

  return NextResponse.json(job, { status: 201 });
}
