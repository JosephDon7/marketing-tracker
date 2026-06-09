import { NextResponse } from 'next/server';
import sql from '../../../lib/db';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(request) {
  const { username, password } = await request.json();

  const users = await sql`
    SELECT * FROM users WHERE username = ${username}
  `;

  if (users.length === 0) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const user = users[0];
  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set('user_id', String(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return NextResponse.json({ success: true, username: user.username });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('user_id');
  return NextResponse.json({ success: true });
}