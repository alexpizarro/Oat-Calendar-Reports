import { z } from 'zod';

// ─── Job types ───────────────────────────────────────────────────────────────
export type JobType = 'SYNC_BACKFILL' | 'SYNC_INCREMENTAL' | 'TAG_COHORT';
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type StatusNorm = 'ATTENDED' | 'NO_SHOW' | 'CANCELLED' | 'BOOKED' | 'OTHER';

// ─── Location settings ────────────────────────────────────────────────────────
export interface StatusMapping {
  [rawStatus: string]: StatusNorm;
}

export interface LocationSettings {
  statusMappings: StatusMapping;
  defaultBackfillMonths: number;         // default 12
  incrementalWindowDays: number;         // default 7
  segmentationField: string;             // e.g. "email_domain" | "source" | "tag:tagName"
}

export const DEFAULT_STATUS_MAPPINGS: StatusMapping = {
  confirmed: 'ATTENDED',
  showed: 'ATTENDED',
  attended: 'ATTENDED',
  completed: 'ATTENDED',
  'no-show': 'NO_SHOW',
  noshow: 'NO_SHOW',
  no_show: 'NO_SHOW',
  missed: 'NO_SHOW',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  'cancelled by contact': 'CANCELLED',
  'cancelled by user': 'CANCELLED',
  booked: 'BOOKED',
  new: 'BOOKED',
  pending: 'BOOKED',
};

// ─── API response helpers ─────────────────────────────────────────────────────
export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Zod schemas for API inputs ───────────────────────────────────────────────
export const ConnectLocationSchema = z.object({
  name: z.string().min(1).max(200),
  timezone: z.string().default('Australia/Melbourne'),
  authMode: z.enum(['oauth', 'private']).default('private'),
  privateToken: z.string().optional(),
  ghlLocationId: z.string().optional(),
});

export type ConnectLocationInput = z.infer<typeof ConnectLocationSchema>;

export const SyncEnqueueSchema = z.object({
  type: z.enum(['SYNC_BACKFILL', 'SYNC_INCREMENTAL']),
  fromDate: z.string().optional(), // ISO date string, for backfill
  calendarIds: z.array(z.string()).optional(),
});

export type SyncEnqueueInput = z.infer<typeof SyncEnqueueSchema>;

export const CohortRuleSchema = z.object({
  metric: z.enum(['no_shows', 'attended', 'cancelled', 'lead_time_avg']),
  operator: z.enum(['gte', 'lte', 'eq']),
  threshold: z.number().int().min(0),
  dateFrom: z.string(), // ISO date
  dateTo: z.string(),   // ISO date
  calendarIds: z.array(z.string()).optional(),
});

export type CohortRule = z.infer<typeof CohortRuleSchema>;

export const CreateCohortSchema = z.object({
  name: z.string().min(1).max(200),
  rule: CohortRuleSchema,
  tagName: z.string().min(1),
  conflictTags: z.array(z.string()).default([]),
});

export type CreateCohortInput = z.infer<typeof CreateCohortSchema>;

export const AnalyticsQuerySchema = z.object({
  from: z.string(),          // ISO date
  to: z.string(),            // ISO date
  calendarIds: z.array(z.string()).optional(),
  granularity: z.enum(['daily', 'weekly']).default('daily'),
  segmentField: z.string().optional(),
});

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
