import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as googleCalendar from '@/lib/google-calendar';

// GET /api/calendar/events - List events
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start and end dates required' }, { status: 400 });
  }

  try {
    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: session.user.id, provider: 'google' },
    });

    if (!connection) {
      return NextResponse.json({ events: [], connected: false });
    }

    // Fetch from Google Calendar
    const googleEvents = await googleCalendar.fetchEvents(
      session.user.id,
      new Date(startDate),
      new Date(endDate)
    );

    // Get local event-task mappings
    const localEvents = await prisma.calendarEvent.findMany({
      where: {
        calendarConnectionId: connection.id,
        startTime: { gte: new Date(startDate) },
        endTime: { lte: new Date(endDate) },
      },
      include: { task: true },
    });

    const taskMap = new Map(localEvents.map(e => [e.externalEventId, e.task]));

    // Merge Google events with task links
    const events = googleEvents.map(event => ({
      id: event.id,
      title: event.summary || 'Untitled',
      description: event.description || null,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      recurrence: event.recurrence,
      color: event.colorId,
      htmlLink: event.htmlLink,
      task: taskMap.get(event.id!) || null,
    }));

    // Update last sync time
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({ events, connected: true });
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

// POST /api/calendar/events - Create event (and optionally link to task)
export async function POST(req: NextRequest) {
  console.log('[Calendar] POST /api/calendar/events - Creating event');
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.log('[Calendar] Unauthorized - no session');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { 
    title, 
    description, 
    start, 
    end, 
    taskId, 
    recurrence,
    colorId 
  } = await req.json();

  console.log('[Calendar] Creating event:', { title, start, end, taskId });

  if (!title || !start || !end) {
    console.log('[Calendar] Missing required fields');
    return NextResponse.json({ error: 'title, start, and end required' }, { status: 400 });
  }

  try {
    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: session.user.id, provider: 'google' },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    // Build recurrence rule if specified
    let recurrenceRule: string[] | undefined;
    if (recurrence) {
      recurrenceRule = googleCalendar.buildRecurrenceRule(
        recurrence.frequency,
        recurrence.interval,
        recurrence.until ? new Date(recurrence.until) : undefined
      );
    }

    // Create in Google Calendar
    const googleEvent = await googleCalendar.createEvent(session.user.id, {
      summary: title,
      description,
      start: new Date(start),
      end: new Date(end),
      recurrence: recurrenceRule,
      colorId,
    });

    // Create local mapping
    const calendarEvent = await prisma.calendarEvent.create({
      data: {
        calendarConnectionId: connection.id,
        externalEventId: googleEvent.id!,
        taskId: taskId || null,
        title,
        description,
        startTime: new Date(start),
        endTime: new Date(end),
        recurrence: recurrence ? JSON.stringify(recurrence) : null,
        color: colorId,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
      },
      include: { task: true },
    });

    console.log('[Calendar] Event created successfully:', googleEvent.id);
    return NextResponse.json({
      event: {
        id: googleEvent.id,
        title: googleEvent.summary,
        description: googleEvent.description,
        start: googleEvent.start?.dateTime || googleEvent.start?.date,
        end: googleEvent.end?.dateTime || googleEvent.end?.date,
        htmlLink: googleEvent.htmlLink,
        task: calendarEvent.task,
      },
    });
  } catch (error) {
    console.error('[Calendar] Failed to create calendar event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
