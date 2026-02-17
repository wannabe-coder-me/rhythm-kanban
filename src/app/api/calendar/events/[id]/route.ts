import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as googleCalendar from '@/lib/google-calendar';

// PATCH /api/calendar/events/[id] - Update event
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const updates = await req.json();

  try {
    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: session.user.id, provider: 'google' },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    // Build update payload
    const googleUpdates: Parameters<typeof googleCalendar.updateEvent>[2] = {};
    if (updates.title !== undefined) googleUpdates.summary = updates.title;
    if (updates.description !== undefined) googleUpdates.description = updates.description;
    if (updates.start) googleUpdates.start = new Date(updates.start);
    if (updates.end) googleUpdates.end = new Date(updates.end);
    if (updates.colorId) googleUpdates.colorId = updates.colorId;
    
    if (updates.recurrence) {
      googleUpdates.recurrence = googleCalendar.buildRecurrenceRule(
        updates.recurrence.frequency,
        updates.recurrence.interval,
        updates.recurrence.until ? new Date(updates.recurrence.until) : undefined
      );
    }

    // Update in Google Calendar
    const googleEvent = await googleCalendar.updateEvent(
      session.user.id,
      eventId,
      googleUpdates
    );

    // Update local mapping if exists
    await prisma.calendarEvent.updateMany({
      where: {
        calendarConnectionId: connection.id,
        externalEventId: eventId,
      },
      data: {
        title: updates.title,
        description: updates.description,
        startTime: updates.start ? new Date(updates.start) : undefined,
        endTime: updates.end ? new Date(updates.end) : undefined,
        recurrence: updates.recurrence ? JSON.stringify(updates.recurrence) : undefined,
        color: updates.colorId,
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({
      event: {
        id: googleEvent.id,
        title: googleEvent.summary,
        description: googleEvent.description,
        start: googleEvent.start?.dateTime || googleEvent.start?.date,
        end: googleEvent.end?.dateTime || googleEvent.end?.date,
        htmlLink: googleEvent.htmlLink,
      },
    });
  } catch (error) {
    console.error('Failed to update calendar event:', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

// DELETE /api/calendar/events/[id] - Delete event
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventId } = await params;

  try {
    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: session.user.id, provider: 'google' },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 });
    }

    // Delete from Google Calendar
    await googleCalendar.deleteEvent(session.user.id, eventId);

    // Delete local mapping
    await prisma.calendarEvent.deleteMany({
      where: {
        calendarConnectionId: connection.id,
        externalEventId: eventId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
