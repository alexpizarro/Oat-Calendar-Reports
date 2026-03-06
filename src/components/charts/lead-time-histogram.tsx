'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { LeadTimeBucket } from '@/lib/analytics/types';

const LABELS: Record<string, string> = {
  under_24h: '<24h',
  '24_48h': '24-48h',
  '3_7d': '3-7d',
  '8_14d': '8-14d',
  '15_30d': '15-30d',
  '30d_plus': '30d+',
};

export function LeadTimeHistogram({ data }: { data: LeadTimeBucket[] }) {
  const chartData = data.map(d => ({ label: LABELS[d.bucket] ?? d.bucket, count: d.count }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={32} />
        <Tooltip />
        <Bar dataKey="count" fill="#6366f1" name="Bookings" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
