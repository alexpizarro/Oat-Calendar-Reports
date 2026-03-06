'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CalendarPopularity } from '@/lib/analytics/types';

export function CalendarPopularityChart({ data }: { data: CalendarPopularity[] }) {
  const chartData = data.map(d => ({
    name: d.calendarName.length > 20 ? d.calendarName.slice(0, 20) + '…' : d.calendarName,
    bookings: d.bookings,
    attended: d.attended,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
        <Tooltip />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="bookings" fill="#6366f1" name="Bookings" radius={[0, 2, 2, 0]} />
        <Bar dataKey="attended" fill="#22c55e" name="Attended" radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
