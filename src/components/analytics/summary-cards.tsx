import type { SummaryMetrics } from '@/lib/analytics/types';

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export function SummaryCards({ metrics }: { metrics: SummaryMetrics }) {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricCard label="Total Bookings" value={metrics.totalBookings.toLocaleString()} />
      <MetricCard label="Attended" value={metrics.attended.toLocaleString()} />
      <MetricCard label="No-Show" value={metrics.noShow.toLocaleString()} />
      <MetricCard label="Cancelled" value={metrics.cancelled.toLocaleString()} />
      <MetricCard
        label="Attendance Rate"
        value={pct(metrics.attendanceRate)}
        sub="excl. cancelled"
      />
      <MetricCard label="Other" value={metrics.other.toLocaleString()} />
    </div>
  );
}
