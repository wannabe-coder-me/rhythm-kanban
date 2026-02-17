import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuthUrl } from '@/lib/google-calendar';
import { prisma } from '@/lib/prisma';

// GET /api/calendar/connect - Get calendar connection status
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const connection = await prisma.calendarConnection.findFirst({
    where: { userId: session.user.id, provider: 'google' },
    select: {
      id: true,
      provider: true,
      email: true,
      syncEnabled: true,
      lastSyncAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ connection });
}

// POST /api/calendar/connect - Initiate OAuth connection
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { provider } = await req.json();

  if (provider !== 'google') {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  // Create state with user ID for security
  const state = Buffer.from(JSON.stringify({
    userId: session.user.id,
    timestamp: Date.now(),
  })).toString('base64');

  const authUrl = getAuthUrl(state);

  return NextResponse.json({ authUrl });
}

// DELETE /api/calendar/connect - Disconnect calendar
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') || 'google';

  await prisma.calendarConnection.deleteMany({
    where: { userId: session.user.id, provider },
  });

  return NextResponse.json({ success: true });
}
