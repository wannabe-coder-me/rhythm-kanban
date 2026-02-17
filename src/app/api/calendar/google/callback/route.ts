import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getCalendarInfo, getOAuth2Client } from '@/lib/google-calendar';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?error=calendar_denied`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?error=invalid_request`
    );
  }

  try {
    // Decode and verify state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { userId, timestamp } = stateData;

    // Check state is not too old (5 minutes)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/settings?error=expired`
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user's email from the calendar
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarInfo = await calendar.calendarList.get({ calendarId: 'primary' });

    // Upsert calendar connection
    await prisma.calendarConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'google',
        },
      },
      create: {
        userId,
        provider: 'google',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        calendarId: 'primary',
        email: calendarInfo.data.id || null,
        syncEnabled: true,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: calendarInfo.data.id || null,
        syncEnabled: true,
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?success=calendar_connected`
    );
  } catch (error) {
    console.error('Calendar connection error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/settings?error=connection_failed`
    );
  }
}
