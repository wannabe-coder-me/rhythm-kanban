import { google, calendar_v3 } from 'googleapis';
import { prisma } from './prisma';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

// OAuth2 client setup
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/calendar/google/callback`
  );
}

// Generate auth URL for user to connect their calendar
export function getAuthUrl(state: string) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // Force consent to get refresh token
  });
}

// Exchange code for tokens
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Get authenticated client for a user
export async function getAuthenticatedClient(userId: string) {
  const connection = await prisma.calendarConnection.findFirst({
    where: { userId, provider: 'google' },
  });

  if (!connection) {
    throw new Error('No Google Calendar connection found');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiresAt?.getTime(),
  });

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: tokens.access_token,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
    }
  });

  return { oauth2Client, connection };
}

// Get calendar API instance
export function getCalendarApi(oauth2Client: ReturnType<typeof getOAuth2Client>) {
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Fetch events from Google Calendar
export async function fetchEvents(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<calendar_v3.Schema$Event[]> {
  const { oauth2Client, connection } = await getAuthenticatedClient(userId);
  const calendar = getCalendarApi(oauth2Client);

  const response = await calendar.events.list({
    calendarId: connection.calendarId || 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items || [];
  
  console.log('[Calendar] Fetched', events.length, 'events for user', connection.email);
  
  // Filter out declined events
  const filtered = events.filter(event => {
    // Check event status first - cancelled events should be hidden
    if (event.status === 'cancelled') {
      console.log('[Calendar] Hiding cancelled:', event.summary);
      return false;
    }
    
    // If no attendees, show the event (it's the user's own event)
    if (!event.attendees || event.attendees.length === 0) {
      return true;
    }
    
    // Log attendee info for debugging
    const selfAttendee = event.attendees.find(a => a.self === true);
    const emailAttendee = connection.email 
      ? event.attendees.find(a => a.email?.toLowerCase() === connection.email?.toLowerCase())
      : null;
    
    const userAttendee = selfAttendee || emailAttendee;
    
    if (userAttendee) {
      console.log('[Calendar] Event:', event.summary, '| Status:', userAttendee.responseStatus);
      
      if (userAttendee.responseStatus === 'declined') {
        console.log('[Calendar] FILTERING declined:', event.summary);
        return false;
      }
    }
    
    return true;
  });
  
  console.log('[Calendar] Returning', filtered.length, 'events after filtering');
  return filtered;
}

// Create event in Google Calendar
export async function createEvent(
  userId: string,
  event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    recurrence?: string[];
    colorId?: string;
  }
): Promise<calendar_v3.Schema$Event> {
  const { oauth2Client, connection } = await getAuthenticatedClient(userId);
  const calendar = getCalendarApi(oauth2Client);

  const response = await calendar.events.insert({
    calendarId: connection.calendarId || 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      recurrence: event.recurrence,
      colorId: event.colorId,
    },
  });

  return response.data;
}

// Update event in Google Calendar
export async function updateEvent(
  userId: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    start?: Date;
    end?: Date;
    recurrence?: string[];
    colorId?: string;
  }
): Promise<calendar_v3.Schema$Event> {
  const { oauth2Client, connection } = await getAuthenticatedClient(userId);
  const calendar = getCalendarApi(oauth2Client);

  const requestBody: calendar_v3.Schema$Event = {};
  
  if (updates.summary !== undefined) requestBody.summary = updates.summary;
  if (updates.description !== undefined) requestBody.description = updates.description;
  if (updates.start) {
    requestBody.start = {
      dateTime: updates.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  if (updates.end) {
    requestBody.end = {
      dateTime: updates.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
  if (updates.recurrence) requestBody.recurrence = updates.recurrence;
  if (updates.colorId) requestBody.colorId = updates.colorId;

  const response = await calendar.events.patch({
    calendarId: connection.calendarId || 'primary',
    eventId,
    requestBody,
  });

  return response.data;
}

// Delete event from Google Calendar
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const { oauth2Client, connection } = await getAuthenticatedClient(userId);
  const calendar = getCalendarApi(oauth2Client);

  await calendar.events.delete({
    calendarId: connection.calendarId || 'primary',
    eventId,
  });
}

// Get user's calendar info
export async function getCalendarInfo(userId: string) {
  const { oauth2Client } = await getAuthenticatedClient(userId);
  const calendar = getCalendarApi(oauth2Client);

  const response = await calendar.calendarList.get({
    calendarId: 'primary',
  });

  return response.data;
}

// Build recurrence rule
export function buildRecurrenceRule(
  frequency: 'daily' | 'weekly' | 'monthly',
  interval: number = 1,
  until?: Date
): string[] {
  let rule = `RRULE:FREQ=${frequency.toUpperCase()};INTERVAL=${interval}`;
  if (until) {
    rule += `;UNTIL=${until.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  }
  return [rule];
}

// Parse Google event to our format
export function parseGoogleEvent(event: calendar_v3.Schema$Event) {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;
  const allDay = !event.start?.dateTime;

  return {
    externalEventId: event.id!,
    title: event.summary || 'Untitled',
    description: event.description || null,
    startTime: new Date(start!),
    endTime: new Date(end!),
    allDay,
    recurrence: event.recurrence?.join(';') || null,
    location: event.location || null,
    color: event.colorId || null,
  };
}
