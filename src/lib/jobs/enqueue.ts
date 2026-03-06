import prisma from '@/lib/prisma';
import type { JobType } from '@/types/api';

interface EnqueueOptions {
  type: JobType;
  locationId: string;
  payload: Record<string, unknown>;
  nextRunAt?: Date;
}

export async function enqueueJob(options: EnqueueOptions) {
  return prisma.job.create({
    data: {
      type: options.type,
      location_id: options.locationId,
      payload_json: JSON.stringify(options.payload),
      status: 'QUEUED',
      next_run_at: options.nextRunAt ?? new Date(),
    },
  });
}

export async function enqueueBackfill(
  locationId: string,
  fromDate: Date,
  toDate?: Date,
  calendarIds?: string[],
) {
  return enqueueJob({
    type: 'SYNC_BACKFILL',
    locationId,
    payload: {
      locationId,
      fromDate: fromDate.toISOString(),
      toDate: (toDate ?? new Date()).toISOString(),
      calendarIds,
    },
  });
}

export async function enqueueIncremental(locationId: string) {
  return enqueueJob({
    type: 'SYNC_INCREMENTAL',
    locationId,
    payload: { locationId },
  });
}

export async function enqueueTagCohort(
  locationId: string,
  payload: Record<string, unknown>,
) {
  return enqueueJob({
    type: 'TAG_COHORT',
    locationId,
    payload,
  });
}
