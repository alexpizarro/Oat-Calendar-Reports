import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminPassword, signSession, makeSessionCookie } from '@/lib/auth';

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { username, password } = parsed.data;
    const adminUsername = process.env.ADMIN_USERNAME;

    if (!adminUsername || username !== adminUsername) {
      // Constant-time rejection to prevent username enumeration
      await new Promise(r => setTimeout(r, 200));
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyAdminPassword(password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signSession(username);
    const cookieHeader = makeSessionCookie(token);

    return NextResponse.json({ ok: true }, {
      status: 200,
      headers: { 'Set-Cookie': cookieHeader },
    });
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
