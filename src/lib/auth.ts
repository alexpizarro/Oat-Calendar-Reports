import { SignJWT, jwtVerify } from 'jose';
import { compare, hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import type { SessionPayload } from '@/types/session';

const COOKIE_NAME = 'session';
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(username: string): Promise<string> {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_DURATION_SECONDS)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload> {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as SessionPayload;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export function makeSessionCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = SESSION_DURATION_SECONDS;
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (isProduction) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const storedHash = process.env.ADMIN_PASSWORD_HASH;
  const username = process.env.ADMIN_USERNAME;

  if (!storedHash || !username) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD_HASH env vars must be set');
  }
  if (!BCRYPT_HASH_REGEX.test(storedHash)) {
    throw new Error('ADMIN_PASSWORD_HASH is not a valid bcrypt hash. In .env files for Next.js, escape each "$" as "\\$".');
  }

  return compare(password, storedHash);
}

/** Utility: hash a password (use once to generate ADMIN_PASSWORD_HASH) */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}
