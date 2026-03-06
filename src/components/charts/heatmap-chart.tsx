'use client';

import type { HeatmapCell } from '@/lib/analytics/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HeatmapChart({ data }: { data: HeatmapCell[] }) {
  // Build lookup grid
  const grid: Record<string, number> = {};
  let max = 0;
  for (const cell of data) {
    const key = `${cell.dayOfWeek}-${cell.hourOfDay}`;
    grid[key] = cell.count;
    if (cell.count > max) max = cell.count;
  }

  function getColor(count: number): string {
    if (count === 0) return 'bg-gray-50';
    const intensity = count / (max || 1);
    if (intensity < 0.2) return 'bg-brand-100';
    if (intensity < 0.4) return 'bg-brand-200';
    if (intensity < 0.6) return 'bg-brand-400';
    if (intensity < 0.8) return 'bg-brand-600';
    return 'bg-brand-800';
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Hour labels */}
        <div className="flex ml-8">
          {HOURS.filter(h => h % 3 === 0).map(h => (
            <div key={h} className="text-xs text-gray-400" style={{ width: `${100 / 8}%` }}>
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-1 mb-0.5">
            <div className="w-7 text-xs text-gray-500 text-right shrink-0">{day}</div>
            <div className="flex gap-0.5 flex-1">
              {HOURS.map(hour => {
                const count = grid[`${dayIdx}-${hour}`] ?? 0;
                return (
                  <div
                    key={hour}
                    className={`flex-1 h-5 rounded-sm ${getColor(count)} cursor-default`}
                    title={`${day} ${String(hour).padStart(2, '0')}:00 — ${count} bookings`}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-2 flex items-center gap-2 ml-8 text-xs text-gray-500">
          <span>Low</span>
          {['bg-brand-100', 'bg-brand-200', 'bg-brand-400', 'bg-brand-600', 'bg-brand-800'].map(c => (
            <div key={c} className={`w-4 h-4 rounded ${c}`} />
          ))}
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
