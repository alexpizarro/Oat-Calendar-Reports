import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { ConnectLocationSchema } from '@/types/api';

export async function GET() {
  const locations = await prisma.location.findMany({
    select: {
      id: true,
      name: true,
      timezone: true,
      auth_mode: true,
      connected_at: true,
      _count: { select: { events: true } },
      jobs: {
        where: { status: 'SUCCEEDED' },
        orderBy: { updated_at: 'desc' },
        take: 1,
        select: { updated_at: true },
      },
    },
    orderBy: { connected_at: 'desc' },
  });

  return NextResponse.json(
    locations.map((l: (typeof locations)[number]) => ({
      id: l.id,
      name: l.name,
      timezone: l.timezone,
      authMode: l.auth_mode,
      connectedAt: l.connected_at,
      totalEvents: l._count.events,
      lastSyncAt: l.jobs[0]?.updated_at ?? null,
    })),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ConnectLocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, timezone, authMode, privateToken } = parsed.data;

  if (authMode === 'private') {
    if (!privateToken) {
      return NextResponse.json({ error: 'privateToken required for private auth mode' }, { status: 400 });
    }

    const location = await prisma.location.create({
      data: {
        name,
        timezone,
        auth_mode: 'private',
        token_encrypted: encrypt(privateToken),
      },
      select: { id: true, name: true, timezone: true, auth_mode: true, connected_at: true },
    });

    return NextResponse.json(location, { status: 201 });
  }

  // OAuth mode: create location with placeholder token, return OAuth URL
  const location = await prisma.location.create({
    data: {
      name,
      timezone,
      auth_mode: 'oauth',
      token_encrypted: encrypt('pending'),
    },
    select: { id: true },
  });

  const clientId = process.env.GHL_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.GHL_REDIRECT_URI ?? '');
  const oauthUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${redirectUri}&client_id=${clientId}&scope=contacts.readonly contacts.write calendars.readonly calendars/events.readonly&state=${location.id}`;

  return NextResponse.json({ locationId: location.id, oauthUrl }, { status: 201 });
}
