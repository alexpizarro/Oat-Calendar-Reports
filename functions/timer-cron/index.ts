import { app, InvocationContext, Timer } from '@azure/functions';

async function timerTrigger(myTimer: Timer, context: InvocationContext): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const secret = process.env.INTERNAL_API_SECRET;

  if (!baseUrl || !secret) {
    context.error('[timer-cron] Missing NEXT_PUBLIC_BASE_URL or INTERNAL_API_SECRET');
    return;
  }

  context.log('[timer-cron] Triggering job runner…');

  try {
    const res = await fetch(`${baseUrl}/api/internal/run-jobs`, {
      method: 'POST',
      headers: {
        'x-internal-secret': secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggeredAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(290_000),
    });

    const result = await res.json();
    context.log('[timer-cron] Job runner result:', JSON.stringify(result));
  } catch (err) {
    context.error('[timer-cron] Failed to trigger job runner:', String(err));
  }
}

app.timer('timer-cron', {
  schedule: '0 */5 * * * *',
  handler: timerTrigger,
});
