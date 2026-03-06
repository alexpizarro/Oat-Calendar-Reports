'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: 'dashboard', label: 'Dashboard' },
  { href: 'insights', label: 'Insights' },
  { href: 'cohorts', label: 'Cohorts' },
  { href: 'sync', label: 'Sync' },
  { href: 'settings', label: 'Settings' },
];

export function NavSidebar({ locationId, locationName }: { locationId: string; locationName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <Link href="/locations" className="text-sm font-bold text-gray-900 hover:text-brand-600">
          ← HL Analytics
        </Link>
        <p className="mt-1 text-xs text-gray-500 truncate">{locationName}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const href = `/locations/${locationId}/${item.href}`;
          const active = pathname === href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
