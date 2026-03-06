'use client';

import { useState } from 'react';
import { use } from 'react';
import { useFetch, defaultDateRange } from '@/hooks/use-analytics';
import { HeatmapChart } from '@/components/charts/heatmap-chart';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import type { HeatmapCell, SegmentRow, ContactAppointmentSummary } from '@/lib/analytics/types';

const SEGMENT_FIELDS = [
  { value: 'email_domain', label: 'Email Domain' },
  { value: 'source', label: 'Source' },
];

export default function InsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [range, setRange] = useState(defaultDateRange);
  const [segmentField, setSegmentField] = useState('email_domain');
  const [drilldownValue, setDrilldownValue] = useState<string | null>(null);

  const q = `from=${range.from}&to=${range.to}`;
  const heatmap = useFetch<HeatmapCell[]>(`/api/locations/${id}/analytics/heatmap?${q}`);
  const segments = useFetch<SegmentRow[]>(
    `/api/locations/${id}/analytics/segments?${q}&field=${segmentField}`,
  );
  const drilldown = useFetch<ContactAppointmentSummary[]>(
    drilldownValue
      ? `/api/locations/${id}/analytics/segments?${q}&field=${segmentField}&segmentValue=${encodeURIComponent(drilldownValue)}`
      : null,
  );

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Insights</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" className="input w-36 text-sm" value={range.from}
            onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" className="input w-36 text-sm" value={range.to}
            onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
        </div>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader><CardTitle>Peak Booking Slots (by hour &amp; day)</CardTitle></CardHeader>
        {heatmap.loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : heatmap.data ? (
          <HeatmapChart data={heatmap.data} />
        ) : null}
      </Card>

      {/* Segmentation */}
      <Card>
        <CardHeader>
          <CardTitle>Segmentation</CardTitle>
          <select
            className="input text-sm w-44"
            value={segmentField}
            onChange={e => { setSegmentField(e.target.value); setDrilldownValue(null); }}
          >
            {SEGMENT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </CardHeader>

        {segments.loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : segments.data ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                  <th className="text-left py-2 pr-4">Value</th>
                  <th className="text-right py-2 pr-4">Bookings</th>
                  <th className="text-right py-2 pr-4">Attended</th>
                  <th className="text-right py-2 pr-4">No-Show</th>
                  <th className="text-right py-2 pr-4">Cancelled</th>
                  <th className="text-right py-2 pr-4">Att. Rate</th>
                  <th className="text-right py-2">Avg Lead</th>
                </tr>
              </thead>
              <tbody>
                {segments.data.map(row => (
                  <tr
                    key={row.value}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDrilldownValue(row.value === drilldownValue ? null : row.value)}
                  >
                    <td className="py-2 pr-4 font-medium text-brand-600">{row.value}</td>
                    <td className="text-right py-2 pr-4">{row.bookings}</td>
                    <td className="text-right py-2 pr-4 text-green-600">{row.attended}</td>
                    <td className="text-right py-2 pr-4 text-red-600">{row.noShow}</td>
                    <td className="text-right py-2 pr-4 text-yellow-600">{row.cancelled}</td>
                    <td className="text-right py-2 pr-4">{pct(row.attendanceRate)}</td>
                    <td className="text-right py-2">
                      {row.avgLeadTimeHours != null ? `${Math.round(row.avgLeadTimeHours)}h` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {/* Drilldown */}
      {drilldownValue && (
        <Card>
          <CardHeader>
            <CardTitle>Contacts — {drilldownValue}</CardTitle>
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setDrilldownValue(null)}>
              ✕ Close
            </button>
          </CardHeader>
          {drilldown.loading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : drilldown.data ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                    <th className="text-left py-2 pr-4">Name</th>
                    <th className="text-left py-2 pr-4">Email</th>
                    <th className="text-right py-2 pr-4">Bookings</th>
                    <th className="text-right py-2 pr-4">Attended</th>
                    <th className="text-right py-2 pr-4">No-Show</th>
                    <th className="text-right py-2">Last Appt</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldown.data.map(c => (
                    <tr key={c.contactId} className="border-b border-gray-50">
                      <td className="py-2 pr-4">{c.contactName ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-500">{c.email ?? '—'}</td>
                      <td className="text-right py-2 pr-4">{c.totalBookings}</td>
                      <td className="text-right py-2 pr-4 text-green-600">{c.attended}</td>
                      <td className="text-right py-2 pr-4 text-red-600">{c.noShow}</td>
                      <td className="text-right py-2 text-gray-400 text-xs">
                        {c.lastAppointment ? new Date(c.lastAppointment).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
