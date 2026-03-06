import { NextRequest, NextResponse } from 'next/server';
import { runJobBatch } from '@/lib/jobs/runner';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const result = await runJobBatch({ startTime, timeLimitMs: 4 * 60 * 1000 });

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[run-jobs]', err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
