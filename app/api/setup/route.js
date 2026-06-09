import { NextResponse } from 'next/server';
import sql from '../../../lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  const { username, password, secret } = await request.json();

  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'User already exists' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = await sql`
    INSERT INTO users (username, password) VALUES (${username}, ${hashed}) RETURNING id, username
  `;

  return NextResponse.json({ success: true, user: result[0] });
}