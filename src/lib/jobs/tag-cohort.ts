import prisma from '@/lib/prisma';
import { GHLClient } from '@/lib/ghl/client';
import { addTagsToContact, bulkUpdateTags } from '@/lib/ghl/contacts';
import type { CohortRule } from '@/types/api';
import { Prisma } from '@prisma/client';

export interface TagCohortPayload {
  locationId: string;
  tagName: string;
  conflictTags: string[];
  rule: CohortRule;
  jobId: string;
}

const BULK_BATCH_SIZE = 100;

export async function runTagCohort(payload: TagCohortPayload): Promise<void> {
  const { locationId, tagName, conflictTags, rule, jobId } = payload;
  const client = new GHLClient(locationId);

  // Step 1: Find matching internal contact IDs
  const matchingIds = await getMatchingContactIds(locationId, rule);
  if (matchingIds.length === 0) {
    await prisma.tagJobResult.create({
      data: {
        job_id: jobId,
        tag_name: tagName,
        action: 'add',
        contacts_targeted: 0,
        contacts_succeeded: 0,
        contacts_failed: 0,
      },
    });
    return;
  }

  // Step 2: Get GHL IDs
  const contacts = await prisma.contact.findMany({
    where: { id: { in: matchingIds } },
    select: { id: true, ghl_id: true },
  });
  const ghlIds = contacts.map(c => c.ghl_id);

  // Step 3: Remove conflict tags
  for (const conflictTag of conflictTags) {
    for (let i = 0; i < ghlIds.length; i += BULK_BATCH_SIZE) {
      const batch = ghlIds.slice(i, i + BULK_BATCH_SIZE);
      try {
        await bulkUpdateTags(client, locationId, batch, [conflictTag], 'remove');
      } catch (e) {
        console.warn(`[tag-cohort] Failed to remove conflict tag "${conflictTag}" batch ${i}:`, e);
      }
    }
  }

  // Step 4: Add new tag
  let succeeded = 0;
  let failed = 0;
  const failures: Array<{ ghlId: string; error: string }> = [];

  for (let i = 0; i < ghlIds.length; i += BULK_BATCH_SIZE) {
    const batch = ghlIds.slice(i, i + BULK_BATCH_SIZE);

    try {
      await bulkUpdateTags(client, locationId, batch, [tagName], 'add');
      succeeded += batch.length;
    } catch {
      // Bulk failed — fall back to single
      for (const ghlId of batch) {
        try {
          await addTagsToContact(client, ghlId, [tagName]);
          succeeded++;
        } catch (singleErr) {
          failed++;
          failures.push({ ghlId, error: String(singleErr) });
        }
      }
    }
  }

  // Step 5: Persist result
  await prisma.tagJobResult.create({
    data: {
      job_id: jobId,
      tag_name: tagName,
      action: 'add',
      contacts_targeted: ghlIds.length,
      contacts_succeeded: succeeded,
      contacts_failed: failed,
      failures_json: failures.length > 0 ? JSON.stringify(failures) : null,
    },
  });
}

export async function getMatchingContactIds(
  locationId: string,
  rule: CohortRule,
): Promise<string[]> {
  const fromDate = new Date(rule.dateFrom);
  const toDate = new Date(rule.dateTo);
  const calendarFilter = rule.calendarIds?.length
    ? Prisma.sql`AND ae.calendar_id IN (${Prisma.join(rule.calendarIds)})`
    : Prisma.empty;

  const opMap: Record<string, string> = { gte: '>=', lte: '<=', eq: '=' };
  const op = opMap[rule.operator] ?? '>=';

  let rows: Array<{ contact_id: string }> = [];

  if (rule.metric === 'no_shows') {
    rows = await prisma.$queryRaw<{ contact_id: string }[]>`
      SELECT ae.contact_id
      FROM AppointmentEvent ae
      WHERE ae.location_id = ${locationId}
        AND ae.status_norm = 'NO_SHOW'
        AND ae.start_at >= ${fromDate}
        AND ae.start_at < ${toDate}
        AND ae.contact_id IS NOT NULL
        ${calendarFilter}
      GROUP BY ae.contact_id
      HAVING COUNT(*) ${Prisma.raw(op)} ${rule.threshold}
    `;
  } else if (rule.metric === 'attended') {
    rows = await prisma.$queryRaw<{ contact_id: string }[]>`
      SELECT ae.contact_id
      FROM AppointmentEvent ae
      WHERE ae.location_id = ${locationId}
        AND ae.status_norm = 'ATTENDED'
        AND ae.start_at >= ${fromDate}
        AND ae.start_at < ${toDate}
        AND ae.contact_id IS NOT NULL
        ${calendarFilter}
      GROUP BY ae.contact_id
      HAVING COUNT(*) ${Prisma.raw(op)} ${rule.threshold}
    `;
  } else if (rule.metric === 'cancelled') {
    rows = await prisma.$queryRaw<{ contact_id: string }[]>`
      SELECT ae.contact_id
      FROM AppointmentEvent ae
      WHERE ae.location_id = ${locationId}
        AND ae.status_norm = 'CANCELLED'
        AND ae.start_at >= ${fromDate}
        AND ae.start_at < ${toDate}
        AND ae.contact_id IS NOT NULL
        ${calendarFilter}
      GROUP BY ae.contact_id
      HAVING COUNT(*) ${Prisma.raw(op)} ${rule.threshold}
    `;
  } else if (rule.metric === 'lead_time_avg') {
    rows = await prisma.$queryRaw<{ contact_id: string }[]>`
      SELECT ae.contact_id
      FROM AppointmentEvent ae
      WHERE ae.location_id = ${locationId}
        AND ae.start_at >= ${fromDate}
        AND ae.start_at < ${toDate}
        AND ae.contact_id IS NOT NULL
        AND ae.booked_at IS NOT NULL
        ${calendarFilter}
      GROUP BY ae.contact_id
      HAVING AVG(DATEDIFF(HOUR, ae.booked_at, ae.start_at)) ${Prisma.raw(op)} ${rule.threshold}
    `;
  }

  return rows.map(r => r.contact_id).filter(Boolean);
}
