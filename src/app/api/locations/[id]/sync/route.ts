import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { enqueueBackfill, enqueueIncremental } from '@/lib/jobs/enqueue';
import { SyncEnqueueSchema } from '@/types/api';
import { parseLocationSettings } from '@/lib/status-mapping';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const jobs = await prisma.job.findMany({
    where: { location_id: id },
    orderBy: { created_at: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      created_at: true,
      updated_at: true,
      last_error: true,
      next_run_at: true,
      results: {
        select: {
          tag_name: true,
          action: true,
          contacts_targeted: true,
          contacts_succeeded: true,
          contacts_failed: true,
        },
      },
    },
  });

  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  const location = await prisma.location.findUnique({
    where: { id },
    select: { id: true, settings_json: true },
  });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = SyncEnqueueSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { type, fromDate, calendarIds } = parsed.data;
  const settings = parseLocationSettings(location.settings_json);

  if (type === 'SYNC_BACKFILL') {
    const backfillFrom = fromDate
      ? new Date(fromDate)
      : new Date(Date.now() - settings.defaultBackfillMonths * 30 * 24 * 60 * 60 * 1000);

    const job = await enqueueBackfill(id, backfillFrom, new Date(), calendarIds);
    return NextResponse.json(job, { status: 201 });
  }

  if (type === 'SYNC_INCREMENTAL') {
    const job = await enqueueIncremental(id);
    return NextResponse.json(job, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
