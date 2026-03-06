'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrendPoint } from '@/lib/analytics/types';

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={32} />
        <Tooltip />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="attended" stroke="#22c55e" strokeWidth={2} dot={false} name="Attended" />
        <Line type="monotone" dataKey="noShow" stroke="#ef4444" strokeWidth={2} dot={false} name="No-Show" />
        <Line type="monotone" dataKey="cancelled" stroke="#f59e0b" strokeWidth={2} dot={false} name="Cancelled" />
        <Line type="monotone" dataKey="bookings" stroke="#6366f1" strokeWidth={1.5} dot={false} name="Total" strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}
