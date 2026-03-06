import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMatchingContactIds } from '@/lib/jobs/tag-cohort';
import { CohortRuleSchema } from '@/types/api';

type Params = { params: { id: string; cohortId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const { id, cohortId } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { id: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = CohortRuleSchema.safeParse(body.rule ?? body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const matchingIds = await getMatchingContactIds(id, parsed.data);
  return NextResponse.json({ cohortId, contactCount: matchingIds.length });
}
