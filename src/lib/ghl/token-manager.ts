import prisma from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/crypto';
import type { GHLTokenResponse } from './types';

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry
const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

export async function getAccessToken(locationId: string): Promise<string> {
  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });

  if (location.auth_mode === 'private') {
    // Private integration token — no expiry, no refresh
    return decrypt(location.token_encrypted);
  }

  // OAuth mode
  const now = new Date();
  const expiresAt = location.token_expires_at;
  const needsRefresh = !expiresAt || expiresAt.getTime() - now.getTime() < REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return decrypt(location.token_encrypted);
  }

  if (!location.refresh_token_encrypted) {
    throw new Error(`Location ${locationId}: OAuth token expired and no refresh token available`);
  }

  const refreshToken = decrypt(location.refresh_token_encrypted);
  const tokens = await refreshAccessToken(refreshToken);

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.location.update({
    where: { id: locationId },
    data: {
      token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: newExpiresAt,
    },
  });

  return tokens.access_token;
}

export async function getGhlLocationId(locationId: string): Promise<string | null> {
  const loc = await prisma.location.findUniqueOrThrow({
    where: { id: locationId },
    select: { ghl_location_id: true },
  });
  return loc.ghl_location_id;
}

async function refreshAccessToken(refreshToken: string): Promise<GHLTokenResponse> {
  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GHL_CLIENT_ID and GHL_CLIENT_SECRET must be set for OAuth mode');
  }

  const res = await fetch(GHL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<GHLTokenResponse>;
}
