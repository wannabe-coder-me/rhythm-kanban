'use client';

import { useState, useCallback } from 'react';
import { addHours } from 'date-fns';

const DEFAULT_WIDTH = 450;

interface CreateEventParams {
  taskId?: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    until?: Date;
  };
}

export function useCalendar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const openCalendar = useCallback(() => setIsOpen(true), []);
  const closeCalendar = useCallback(() => setIsOpen(false), []);
  const toggleCalendar = useCallback(() => setIsOpen(prev => !prev), []);
  const handleWidthChange = useCallback((newWidth: number) => setWidth(newWidth), []);

  const createEvent = useCallback(async (params: CreateEventParams) => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: params.title,
          description: params.description,
          start: params.start.toISOString(),
          end: params.end.toISOString(),
          taskId: params.taskId,
          recurrence: params.recurrence,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create event');
      }

      const data = await res.json();
      return data.event;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const createEventFromTask = useCallback(async (
    taskId: string, 
    taskTitle: string,
    start: Date,
    durationHours: number = 1
  ) => {
    const end = addHours(start, durationHours);
    return createEvent({
      taskId,
      title: taskTitle,
      start,
      end,
    });
  }, [createEvent]);

  const updateEvent = useCallback(async (eventId: string, updates: Partial<CreateEventParams>) => {
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          start: updates.start?.toISOString(),
          end: updates.end?.toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update event');
      }

      const data = await res.json();
      return data.event;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      throw error;
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete event');
      }

      return true;
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      throw error;
    }
  }, []);

  return {
    isOpen,
    isCreating,
    width,
    openCalendar,
    closeCalendar,
    toggleCalendar,
    handleWidthChange,
    createEvent,
    createEventFromTask,
    updateEvent,
    deleteEvent,
  };
}
