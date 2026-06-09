import { NextResponse } from 'next/server';
import sql from '../../../lib/db';
import { cookies } from 'next/headers';

async function getUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  return userId ? parseInt(userId) : null;
}

export async function GET() {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entries = await sql`
    SELECT * FROM entries WHERE user_id = ${userId} ORDER BY date DESC
  `;
  return NextResponse.json(entries);
}

export async function POST(request) {
  const userId = await getUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { date, spend, revenue, sales, cpu, campaign } = await request.json();

  const result = await sql`
    INSERT INTO entries (user_id, date, spend, revenue, sales, cpu, campaign)
    VALUES (${userId}, ${date}, ${spend}, ${revenue}, ${sales}, ${cpu}, ${campaign})
    RETURNING *
  `;
  return NextResponse.json(result[0]);
}