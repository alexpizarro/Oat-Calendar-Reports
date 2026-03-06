import prisma from '@/lib/prisma';
import { runBackfill } from '@/lib/sync/backfill';
import { runIncremental } from '@/lib/sync/incremental';
import { runTagCohort } from './tag-cohort';
import type { BackfillPayload } from '@/lib/sync/backfill';
import type { IncrementalPayload } from '@/lib/sync/incremental';
import type { TagCohortPayload } from './tag-cohort';

const RUNNER_TIMEOUT_MS = 4 * 60 * 1000;  // 4 minutes
const MAX_JOBS_PER_RUN = 10;

export interface RunnerResult {
  jobsProcessed: number;
  jobsSucceeded: number;
  jobsFailed: number;
  timedOut: boolean;
}

export async function runJobBatch(options?: {
  startTime?: number;
  timeLimitMs?: number;
}): Promise<RunnerResult> {
  const startTime = options?.startTime ?? Date.now();
  const timeLimit = options?.timeLimitMs ?? RUNNER_TIMEOUT_MS;
  const stats = { jobsProcessed: 0, jobsSucceeded: 0, jobsFailed: 0, timedOut: false };

  for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
    if (Date.now() - startTime > timeLimit - 30_000) {
      stats.timedOut = true;
      break;
    }

    const job = await claimNextJob();
    if (!job) break;

    stats.jobsProcessed++;

    try {
      await executeJob(job);

      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'SUCCEEDED' },
      });

      stats.jobsSucceeded++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const nextAttempts = job.attempts + 1;
      const maxAttempts = 3;

      if (nextAttempts >= maxAttempts) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'FAILED', last_error: errorMsg, attempts: nextAttempts },
        });
      } else {
        const backoffMs = Math.pow(nextAttempts, 2) * 60_000;
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'QUEUED',
            attempts: nextAttempts,
            last_error: errorMsg,
            next_run_at: new Date(Date.now() + backoffMs),
          },
        });
      }

      stats.jobsFailed++;
      console.error(`[runner] Job ${job.id} (${job.type}) failed:`, err);
    }
  }

  return stats;
}

async function claimNextJob() {
  // Atomic claim using raw SQL (SQL Server UPDATE ... OUTPUT)
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    type: string;
    location_id: string;
    payload_json: string;
    attempts: number;
  }>>`
    UPDATE TOP(1) Job
    SET status = 'RUNNING', updated_at = GETUTCDATE()
    OUTPUT
      INSERTED.id,
      INSERTED.type,
      INSERTED.location_id,
      INSERTED.payload_json,
      INSERTED.attempts
    WHERE status = 'QUEUED'
      AND next_run_at <= GETUTCDATE()
  `;

  return rows[0] ?? null;
}

async function executeJob(job: {
  id: string;
  type: string;
  location_id: string;
  payload_json: string;
  attempts: number;
}): Promise<void> {
  const payload = JSON.parse(job.payload_json) as unknown;

  switch (job.type) {
    case 'SYNC_BACKFILL':
      await runBackfill(job.id, payload as BackfillPayload);
      break;

    case 'SYNC_INCREMENTAL':
      await runIncremental(payload as IncrementalPayload);
      break;

    case 'TAG_COHORT':
      await runTagCohort({ ...(payload as Record<string, unknown>), jobId: job.id } as unknown as TagCohortPayload);
      break;

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}
