import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import type {
  SummaryMetrics,
  TrendPoint,
  CalendarPopularity,
  HeatmapCell,
  LeadTimeBucket,
  SegmentRow,
  ContactAppointmentSummary,
} from './types';

// IANA timezone → SQL Server timezone name mapping
const IANA_TO_SQLSERVER: Record<string, string> = {
  'Australia/Melbourne': 'AUS Eastern Standard Time',
  'Australia/Sydney': 'AUS Eastern Standard Time',
  'Australia/Brisbane': 'E. Australia Standard Time',
  'Australia/Perth': 'W. Australia Standard Time',
  'Australia/Adelaide': 'Cen. Australia Standard Time',
  'America/New_York': 'Eastern Standard Time',
  'America/Chicago': 'Central Standard Time',
  'America/Denver': 'Mountain Standard Time',
  'America/Los_Angeles': 'Pacific Standard Time',
  'Europe/London': 'GMT Standard Time',
  'Europe/Berlin': 'W. Europe Standard Time',
  'Asia/Tokyo': 'Tokyo Standard Time',
  'Asia/Singapore': 'Singapore Standard Time',
  'UTC': 'UTC',
};

function sqlTz(ianaTimezone: string): string {
  return IANA_TO_SQLSERVER[ianaTimezone] ?? 'UTC';
}

function calendarFilterSql(calendarIds?: string[]) {
  if (!calendarIds?.length) return Prisma.empty;
  return Prisma.sql`AND ae.calendar_id IN (${Prisma.join(calendarIds)})`;
}

// ─── Summary metrics ──────────────────────────────────────────────────────────
export async function querySummary(
  locationId: string,
  from: Date,
  to: Date,
  calendarIds?: string[],
): Promise<SummaryMetrics> {
  const calFilter = calendarFilterSql(calendarIds);

  const rows = await prisma.$queryRaw<Array<{ status_norm: string; cnt: number }>>`
    SELECT ae.status_norm, COUNT(*) AS cnt
    FROM AppointmentEvent ae
    WHERE ae.location_id = ${locationId}
      AND ae.start_at >= ${from}
      AND ae.start_at < ${to}
      ${calFilter}
    GROUP BY ae.status_norm
  `;

  const byStatus = Object.fromEntries(rows.map(r => [r.status_norm, Number(r.cnt)]));
  const attended = byStatus['ATTENDED'] ?? 0;
  const noShow = byStatus['NO_SHOW'] ?? 0;
  const cancelled = byStatus['CANCELLED'] ?? 0;
  const booked = byStatus['BOOKED'] ?? 0;
  const other = byStatus['OTHER'] ?? 0;
  const totalBookings = attended + noShow + cancelled + booked + other;
  const attendanceRate = attended + noShow > 0 ? attended / (attended + noShow) : 0;

  return { totalBookings, attended, noShow, cancelled, other, attendanceRate };
}

// ─── Trend ────────────────────────────────────────────────────────────────────
export async function queryTrend(
  locationId: string,
  from: Date,
  to: Date,
  timezone: string,
  granularity: 'daily' | 'weekly',
  calendarIds?: string[],
): Promise<TrendPoint[]> {
  const tz = sqlTz(timezone);
  const calFilter = calendarFilterSql(calendarIds);

  if (granularity === 'daily') {
    const rows = await prisma.$queryRaw<Array<{
      d: string; status_norm: string; cnt: number;
    }>>`
      SELECT
        CONVERT(VARCHAR(10),
          CAST(ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz} AS DATE),
          120
        ) AS d,
        ae.status_norm,
        COUNT(*) AS cnt
      FROM AppointmentEvent ae
      WHERE ae.location_id = ${locationId}
        AND ae.start_at >= ${from}
        AND ae.start_at < ${to}
        ${calFilter}
      GROUP BY
        CAST(ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz} AS DATE),
        ae.status_norm
      ORDER BY d
    `;
    return aggregateTrendRows(rows);
  } else {
    // Weekly: use ISO year+week as bucket
    const rows = await prisma.$queryRaw<Array<{
      d: string; status_norm: string; cnt: number;
    }>>`
      SELECT
        CONCAT(
          DATEPART(YEAR, ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}),
          '-W',
          RIGHT('0' + CAST(DATEPART(ISO_WEEK, ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) AS VARCHAR), 2)
        ) AS d,
        ae.status_norm,
        COUNT(*) AS cnt
      FROM AppointmentEvent ae
      WHERE ae.location_id = ${locationId}
        AND ae.start_at >= ${from}
        AND ae.start_at < ${to}
        ${calFilter}
      GROUP BY
        DATEPART(YEAR, ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}),
        DATEPART(ISO_WEEK, ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}),
        ae.status_norm
      ORDER BY d
    `;
    return aggregateTrendRows(rows);
  }
}

function aggregateTrendRows(
  rows: Array<{ d: string; status_norm: string; cnt: number }>,
): TrendPoint[] {
  const map = new Map<string, TrendPoint>();

  for (const row of rows) {
    const existing = map.get(row.d) ?? {
      date: row.d,
      bookings: 0,
      attended: 0,
      noShow: 0,
      cancelled: 0,
    };
    const count = Number(row.cnt);
    existing.bookings += count;
    if (row.status_norm === 'ATTENDED') existing.attended += count;
    else if (row.status_norm === 'NO_SHOW') existing.noShow += count;
    else if (row.status_norm === 'CANCELLED') existing.cancelled += count;
    map.set(row.d, existing);
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Calendar popularity ──────────────────────────────────────────────────────
export async function queryCalendarPopularity(
  locationId: string,
  from: Date,
  to: Date,
): Promise<CalendarPopularity[]> {
  const rows = await prisma.$queryRaw<Array<{
    calendar_id: string; cal_name: string; status_norm: string; cnt: number;
  }>>`
    SELECT
      ae.calendar_id,
      c.name AS cal_name,
      ae.status_norm,
      COUNT(*) AS cnt
    FROM AppointmentEvent ae
    LEFT JOIN Calendar c ON c.id = ae.calendar_id
    WHERE ae.location_id = ${locationId}
      AND ae.start_at >= ${from}
      AND ae.start_at < ${to}
      AND ae.calendar_id IS NOT NULL
    GROUP BY ae.calendar_id, c.name, ae.status_norm
    ORDER BY ae.calendar_id
  `;

  const map = new Map<string, CalendarPopularity>();
  for (const row of rows) {
    const existing = map.get(row.calendar_id) ?? {
      calendarId: row.calendar_id,
      calendarName: row.cal_name ?? 'Unknown',
      bookings: 0,
      attended: 0,
    };
    existing.bookings += Number(row.cnt);
    if (row.status_norm === 'ATTENDED') existing.attended += Number(row.cnt);
    map.set(row.calendar_id, existing);
  }

  return [...map.values()].sort((a, b) => b.bookings - a.bookings);
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────
export async function queryHeatmap(
  locationId: string,
  from: Date,
  to: Date,
  timezone: string,
  calendarIds?: string[],
): Promise<HeatmapCell[]> {
  const tz = sqlTz(timezone);
  const calFilter = calendarFilterSql(calendarIds);

  // SQL Server: DATEPART(WEEKDAY,...) returns 1=Sunday through 7=Saturday
  const rows = await prisma.$queryRaw<Array<{
    day_of_week: number; hour_of_day: number; cnt: number;
  }>>`
    SELECT
      DATEPART(WEEKDAY, ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) - 1 AS day_of_week,
      DATEPART(HOUR,    ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) AS hour_of_day,
      COUNT(*) AS cnt
    FROM AppointmentEvent ae
    WHERE ae.location_id = ${locationId}
      AND ae.start_at >= ${from}
      AND ae.start_at < ${to}
      ${calFilter}
    GROUP BY
      DATEPART(WEEKDAY, ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}),
      DATEPART(HOUR,    ae.start_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz})
  `;

  return rows.map(r => ({
    dayOfWeek: Number(r.day_of_week),
    hourOfDay: Number(r.hour_of_day),
    count: Number(r.cnt),
  }));
}

// ─── Lead time histogram ──────────────────────────────────────────────────────
export async function queryLeadTime(
  locationId: string,
  from: Date,
  to: Date,
  calendarIds?: string[],
): Promise<LeadTimeBucket[]> {
  const calFilter = calendarFilterSql(calendarIds);

  const rows = await prisma.$queryRaw<Array<{ bucket: string; cnt: number }>>`
    SELECT
      CASE
        WHEN DATEDIFF(HOUR, ae.booked_at, ae.start_at) < 24   THEN 'under_24h'
        WHEN DATEDIFF(HOUR, ae.booked_at, ae.start_at) < 48   THEN '24_48h'
        WHEN DATEDIFF(DAY,  ae.booked_at, ae.start_at) < 7    THEN '3_7d'
        WHEN DATEDIFF(DAY,  ae.booked_at, ae.start_at) < 14   THEN '8_14d'
        WHEN DATEDIFF(DAY,  ae.booked_at, ae.start_at) < 30   THEN '15_30d'
        ELSE '30d_plus'
      END AS bucket,
      COUNT(*) AS cnt
    FROM AppointmentEvent ae
    WHERE ae.location_id = ${locationId}
      AND ae.start_at >= ${from}
      AND ae.start_at < ${to}
      AND ae.booked_at IS NOT NULL
      AND ae.start_at > ae.booked_at
      ${calFilter}
    GROUP BY
      CASE
        WHEN DATEDIFF(HOUR, ae.booked_at, ae.start_at) < 24   THEN 'under_24h'
        WHEN DATEDIFF(HOUR, ae.booked_at, ae.start_at) < 48   THEN '24_48h'
        WHEN DATEDIFF(DAY,  ae.booked_at, ae.start_at) < 7    THEN '3_7d'
        WHEN DATEDIFF(DAY,  ae.booked_at, ae.start_at) < 14   THEN '8_14d'
        WHEN DATEDIFF(DAY,  ae.booked_at, ae.start_at) < 30   THEN '15_30d'
        ELSE '30d_plus'
      END
  `;

  const ORDER: LeadTimeBucket['bucket'][] = ['under_24h', '24_48h', '3_7d', '8_14d', '15_30d', '30d_plus'];
  const byBucket = Object.fromEntries(rows.map(r => [r.bucket, Number(r.cnt)]));
  return ORDER.map(b => ({ bucket: b, count: byBucket[b] ?? 0 }));
}

// ─── Segmentation ─────────────────────────────────────────────────────────────
export async function querySegmentation(
  locationId: string,
  from: Date,
  to: Date,
  segmentField: string, // "email_domain" | "source" | "tag:tagname"
  calendarIds?: string[],
): Promise<SegmentRow[]> {
  const calFilter = calendarFilterSql(calendarIds);

  let segmentExpr: Prisma.Sql;

  if (segmentField === 'email_domain') {
    segmentExpr = Prisma.sql`
      CASE
        WHEN co.email LIKE '%@%'
          THEN SUBSTRING(co.email, CHARINDEX('@', co.email) + 1, LEN(co.email))
        ELSE 'unknown'
      END
    `;
  } else if (segmentField === 'source') {
    segmentExpr = Prisma.sql`ISNULL(JSON_VALUE(co.raw_json, '$.source'), 'unknown')`;
  } else {
    segmentExpr = Prisma.sql`'unsupported_field'`;
  }

  const rows = await prisma.$queryRaw<Array<{
    segment_value: string;
    status_norm: string;
    cnt: number;
    avg_lead_hours: number | null;
  }>>`
    SELECT
      ${segmentExpr} AS segment_value,
      ae.status_norm,
      COUNT(*) AS cnt,
      AVG(CAST(DATEDIFF(HOUR, ae.booked_at, ae.start_at) AS FLOAT)) AS avg_lead_hours
    FROM AppointmentEvent ae
    LEFT JOIN Contact co ON co.id = ae.contact_id
    WHERE ae.location_id = ${locationId}
      AND ae.start_at >= ${from}
      AND ae.start_at < ${to}
      ${calFilter}
    GROUP BY ${segmentExpr}, ae.status_norm
    ORDER BY ${segmentExpr}
  `;

  const map = new Map<string, SegmentRow>();
  for (const row of rows) {
    const val = row.segment_value ?? 'unknown';
    const existing = map.get(val) ?? {
      value: val,
      bookings: 0,
      attended: 0,
      noShow: 0,
      cancelled: 0,
      attendanceRate: 0,
      avgLeadTimeHours: null,
    };
    const count = Number(row.cnt);
    existing.bookings += count;
    if (row.status_norm === 'ATTENDED') existing.attended += count;
    else if (row.status_norm === 'NO_SHOW') existing.noShow += count;
    else if (row.status_norm === 'CANCELLED') existing.cancelled += count;

    if (row.avg_lead_hours != null) {
      existing.avgLeadTimeHours = row.avg_lead_hours;
    }
    map.set(val, existing);
  }

  return [...map.values()].map(row => ({
    ...row,
    attendanceRate:
      row.attended + row.noShow > 0
        ? row.attended / (row.attended + row.noShow)
        : 0,
  })).sort((a, b) => b.bookings - a.bookings);
}

// ─── Contact drilldown ────────────────────────────────────────────────────────
export async function queryContactsBySegment(
  locationId: string,
  from: Date,
  to: Date,
  segmentField: string,
  segmentValue: string,
  calendarIds?: string[],
): Promise<ContactAppointmentSummary[]> {
  const calFilter = calendarFilterSql(calendarIds);

  let segmentWhere: Prisma.Sql;
  if (segmentField === 'email_domain') {
    segmentWhere = Prisma.sql`
      AND (
        CASE
          WHEN co.email LIKE '%@%'
            THEN SUBSTRING(co.email, CHARINDEX('@', co.email) + 1, LEN(co.email))
          ELSE 'unknown'
        END
      ) = ${segmentValue}
    `;
  } else if (segmentField === 'source') {
    segmentWhere = Prisma.sql`
      AND ISNULL(JSON_VALUE(co.raw_json, '$.source'), 'unknown') = ${segmentValue}
    `;
  } else {
    segmentWhere = Prisma.empty;
  }

  const rows = await prisma.$queryRaw<Array<{
    contact_id: string;
    contact_name: string | null;
    email: string | null;
    status_norm: string;
    cnt: number;
    last_appt: string | null;
  }>>`
    SELECT
      ae.contact_id,
      co.name AS contact_name,
      co.email,
      ae.status_norm,
      COUNT(*) AS cnt,
      MAX(CONVERT(VARCHAR(24), ae.start_at, 126)) AS last_appt
    FROM AppointmentEvent ae
    LEFT JOIN Contact co ON co.id = ae.contact_id
    WHERE ae.location_id = ${locationId}
      AND ae.start_at >= ${from}
      AND ae.start_at < ${to}
      AND ae.contact_id IS NOT NULL
      ${segmentWhere}
      ${calFilter}
    GROUP BY ae.contact_id, co.name, co.email, ae.status_norm
    ORDER BY ae.contact_id
  `;

  const map = new Map<string, ContactAppointmentSummary>();
  for (const row of rows) {
    const existing = map.get(row.contact_id) ?? {
      contactId: row.contact_id,
      contactName: row.contact_name ?? null,
      email: row.email ?? null,
      totalBookings: 0,
      attended: 0,
      noShow: 0,
      cancelled: 0,
      lastAppointment: null,
    };
    const count = Number(row.cnt);
    existing.totalBookings += count;
    if (row.status_norm === 'ATTENDED') existing.attended += count;
    else if (row.status_norm === 'NO_SHOW') existing.noShow += count;
    else if (row.status_norm === 'CANCELLED') existing.cancelled += count;
    if (row.last_appt && (!existing.lastAppointment || row.last_appt > existing.lastAppointment)) {
      existing.lastAppointment = row.last_appt;
    }
    map.set(row.contact_id, existing);
  }

  return [...map.values()].sort((a, b) => b.totalBookings - a.totalBookings);
}

// ─── Repeat attendance ────────────────────────────────────────────────────────
export async function queryRepeatAttendance(
  locationId: string,
  from: Date,
  to: Date,
): Promise<{ repeatContacts: number; totalAttendedContacts: number; repeatRate: number }> {
  const rows = await prisma.$queryRaw<Array<{ category: string; cnt: number }>>`
    SELECT
      CASE WHEN attended_count >= 2 THEN 'repeat' ELSE 'once' END AS category,
      COUNT(*) AS cnt
    FROM (
      SELECT ae.contact_id, COUNT(*) AS attended_count
      FROM AppointmentEvent ae
      WHERE ae.location_id = ${locationId}
        AND ae.status_norm = 'ATTENDED'
        AND ae.start_at >= ${from}
        AND ae.start_at < ${to}
        AND ae.contact_id IS NOT NULL
      GROUP BY ae.contact_id
    ) sub
    GROUP BY CASE WHEN attended_count >= 2 THEN 'repeat' ELSE 'once' END
  `;

  const byCategory = Object.fromEntries(rows.map(r => [r.category, Number(r.cnt)]));
  const repeat = byCategory['repeat'] ?? 0;
  const once = byCategory['once'] ?? 0;
  const total = repeat + once;

  return {
    repeatContacts: repeat,
    totalAttendedContacts: total,
    repeatRate: total > 0 ? repeat / total : 0,
  };
}
