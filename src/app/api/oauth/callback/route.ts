import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const locationId = searchParams.get('state'); // passed as OAuth state param

  if (!code || !locationId) {
    return NextResponse.redirect(new URL('/locations?error=oauth_missing_params', req.url));
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location) {
    return NextResponse.redirect(new URL('/locations?error=location_not_found', req.url));
  }

  try {
    const clientId = process.env.GHL_CLIENT_ID;
    const clientSecret = process.env.GHL_CLIENT_SECRET;
    const redirectUri = process.env.GHL_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('GHL OAuth env vars not configured');
    }

    const res = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Token exchange failed (${res.status}): ${body}`);
    }

    const tokens = await res.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      locationId?: string;
    };

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.location.update({
      where: { id: locationId },
      data: {
        auth_mode: 'oauth',
        token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: encrypt(tokens.refresh_token),
        token_expires_at: expiresAt,
        ghl_location_id: tokens.locationId ?? null,
        connected_at: new Date(),
      },
    });

    return NextResponse.redirect(
      new URL(`/locations/${locationId}/settings?connected=true`, req.url),
    );
  } catch (err) {
    console.error('[oauth/callback]', err);
    return NextResponse.redirect(
      new URL(`/locations/${locationId}/settings?error=oauth_failed`, req.url),
    );
  }
}
