import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const location = await prisma.location.findUnique({ where: { id }, select: { id: true } });
  if (!location) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const q = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = QuerySchema.safeParse(q);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });

  const { page, pageSize, search } = parsed.data;
  const skip = (page - 1) * pageSize;

  const where = {
    location_id: id,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { updated_at: 'desc' },
      select: {
        id: true,
        ghl_id: true,
        name: true,
        email: true,
        phone: true,
        tags_json: true,
        updated_at: true,
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({
    data: contacts.map((c: (typeof contacts)[number]) => ({
      ...c,
      tags: c.tags_json ? JSON.parse(c.tags_json) : [],
    })),
    total,
    page,
    pageSize,
  });
}
