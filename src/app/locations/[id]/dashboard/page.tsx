'use client';

import { useState } from 'react';
import { useFetch, defaultDateRange } from '@/hooks/use-analytics';
import { SummaryCards } from '@/components/analytics/summary-cards';
import { TrendChart } from '@/components/charts/trend-chart';
import { CalendarPopularityChart } from '@/components/charts/calendar-popularity';
import { LeadTimeHistogram } from '@/components/charts/lead-time-histogram';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import type { SummaryMetrics, TrendPoint, CalendarPopularity, LeadTimeBucket } from '@/lib/analytics/types';

export default function DashboardPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [range, setRange] = useState(defaultDateRange);
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily');

  const q = `from=${range.from}&to=${range.to}`;

  const summary = useFetch<SummaryMetrics>(`/api/locations/${id}/analytics/summary?${q}`);
  const trend = useFetch<TrendPoint[]>(`/api/locations/${id}/analytics/trend?${q}&granularity=${granularity}`);
  const calendars = useFetch<CalendarPopularity[]>(`/api/locations/${id}/analytics/calendars?${q}`);
  const leadTime = useFetch<LeadTimeBucket[]>(`/api/locations/${id}/analytics/leadtime?${q}`);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From</label>
            <input
              type="date"
              className="input w-36 text-sm"
              value={range.from}
              onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To</label>
            <input
              type="date"
              className="input w-36 text-sm"
              value={range.to}
              onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
            />
          </div>
          <select
            className="input text-sm w-28"
            value={granularity}
            onChange={e => setGranularity(e.target.value as 'daily' | 'weekly')}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      {summary.loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : summary.data ? (
        <SummaryCards metrics={summary.data} />
      ) : null}

      {/* Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Bookings Over Time</CardTitle>
        </CardHeader>
        {trend.loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : trend.data ? (
          <TrendChart data={trend.data} />
        ) : null}
      </Card>

      {/* Calendar popularity + Lead time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Calendar Popularity</CardTitle></CardHeader>
          {calendars.loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : calendars.data ? (
            <CalendarPopularityChart data={calendars.data} />
          ) : null}
        </Card>

        <Card>
          <CardHeader><CardTitle>Lead Time Distribution</CardTitle></CardHeader>
          {leadTime.loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : leadTime.data ? (
            <LeadTimeHistogram data={leadTime.data} />
          ) : null}
        </Card>
      </div>
    </div>
  );
}
