import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { NavSidebar } from '@/components/layout/nav-sidebar';

export default async function LocationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { id } = params;
  const location = await prisma.location.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!location) notFound();

  return (
    <div className="flex min-h-screen">
      <NavSidebar locationId={location.id} locationName={location.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
