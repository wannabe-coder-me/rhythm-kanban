'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, endOfWeek, startOfDay, addHours, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, X, Calendar, Loader2, Link2 } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay?: boolean;
  color?: string;
  htmlLink?: string;
  task?: {
    id: string;
    title: string;
    priority: string;
  } | null;
}

interface CalendarPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreate?: (event: { 
    taskId?: string; 
    title?: string;
    start: Date; 
    end: Date;
    recurrence?: { frequency: 'daily' | 'weekly' | 'monthly'; interval?: number };
  }) => void;
  onEventUpdate?: (eventId: string, updates: { start?: Date; end?: Date }) => void;
  onEventDelete?: (eventId: string) => Promise<void>;
  onWidthChange?: (width: number) => void;
  initialWidth?: number;
  refreshKey?: number;
}

type ViewMode = 'day' | 'week';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Variable hour heights: business hours (6am-6pm) are taller
const BUSINESS_HOUR_HEIGHT = 48; // pixels per hour during business hours
const OFF_HOUR_HEIGHT = 20; // pixels per hour during off hours
const BUSINESS_START = 6; // 6am
const BUSINESS_END = 18; // 6pm

// Get the height for a specific hour
const getHourHeight = (hour: number) => {
  return (hour >= BUSINESS_START && hour < BUSINESS_END) ? BUSINESS_HOUR_HEIGHT : OFF_HOUR_HEIGHT;
};

// Get the Y position (top) for a specific time (hour + fraction)
const getYPosition = (time: number) => {
  let y = 0;
  const wholeHour = Math.floor(time);
  const fraction = time - wholeHour;
  
  for (let h = 0; h < wholeHour; h++) {
    y += getHourHeight(h);
  }
  y += fraction * getHourHeight(wholeHour);
  return y;
};

// Get total height of all hours
const getTotalHeight = () => {
  return HOURS.reduce((sum, h) => sum + getHourHeight(h), 0);
};

const MIN_WIDTH = 280;
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = 450;

export default function CalendarPanel({ isOpen, onClose, onEventCreate, onEventUpdate, onEventDelete, onWidthChange, initialWidth = DEFAULT_WIDTH, refreshKey }: CalendarPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingEvent, setResizingEvent] = useState<{ id: string; edge: 'top' | 'bottom'; startY: number; originalStart: Date; originalEnd: Date } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Event creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventData, setNewEventData] = useState<{ start: Date; end: Date } | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventRecurrence, setNewEventRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  
  // Event detail modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Event drag (move) state
  const [draggingEvent, setDraggingEvent] = useState<{ id: string; startY: number; startX: number; originalStart: Date; originalEnd: Date } | null>(null);

  // Handle resize drag
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      setWidth(clampedWidth);
      onWidthChange?.(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle event resize drag
  useEffect(() => {
    if (!resizingEvent) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizingEvent.startY;
      // Use business hour height for resize calculations (most resizing happens during business hours)
      const deltaHours = deltaY / BUSINESS_HOUR_HEIGHT;
      
      if (resizingEvent.edge === 'bottom') {
        // Extend/shrink end time
        const newEnd = new Date(resizingEvent.originalEnd.getTime() + deltaHours * 60 * 60 * 1000);
        // Minimum 30 min duration
        if (newEnd > new Date(resizingEvent.originalStart.getTime() + 30 * 60 * 1000)) {
          setEvents(prev => prev.map(ev => 
            ev.id === resizingEvent.id ? { ...ev, end: newEnd.toISOString() } : ev
          ));
        }
      } else {
        // Move start time
        const newStart = new Date(resizingEvent.originalStart.getTime() + deltaHours * 60 * 60 * 1000);
        // Minimum 30 min duration
        if (newStart < new Date(resizingEvent.originalEnd.getTime() - 30 * 60 * 1000)) {
          setEvents(prev => prev.map(ev => 
            ev.id === resizingEvent.id ? { ...ev, start: newStart.toISOString() } : ev
          ));
        }
      }
    };

    const handleMouseUp = () => {
      // Save the new times
      const event = events.find(e => e.id === resizingEvent.id);
      if (event && onEventUpdate) {
        onEventUpdate(resizingEvent.id, {
          start: parseISO(event.start),
          end: parseISO(event.end),
        });
      }
      setResizingEvent(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingEvent, events, onEventUpdate]);

  // Handle event drag (move)
  useEffect(() => {
    if (!draggingEvent) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - draggingEvent.startY;
      const deltaHours = deltaY / BUSINESS_HOUR_HEIGHT;
      
      // Move both start and end by the same amount
      const newStart = new Date(draggingEvent.originalStart.getTime() + deltaHours * 60 * 60 * 1000);
      const newEnd = new Date(draggingEvent.originalEnd.getTime() + deltaHours * 60 * 60 * 1000);
      
      setEvents(prev => prev.map(ev => 
        ev.id === draggingEvent.id 
          ? { ...ev, start: newStart.toISOString(), end: newEnd.toISOString() } 
          : ev
      ));
    };

    const handleMouseUp = () => {
      const event = events.find(e => e.id === draggingEvent.id);
      if (event && onEventUpdate) {
        onEventUpdate(draggingEvent.id, {
          start: parseISO(event.start),
          end: parseISO(event.end),
        });
      }
      setDraggingEvent(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'grab';
    document.body.style.userSelect = 'none';
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingEvent, events, onEventUpdate]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      const start = viewMode === 'day' ? startOfDay(currentDate) : ws;
      const end = viewMode === 'day' ? addDays(startOfDay(currentDate), 1) : addDays(we, 1);
      
      const res = await fetch(
        `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      const data = await res.json();
      
      setIsConnected(data.connected ?? false);
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen, currentDate, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh events when refreshKey changes (e.g., after drag-drop creates an event)
  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (isOpen && refreshKey !== undefined && refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey;
      fetchEvents();
    }
  }, [refreshKey, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/calendar/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      });
      const { authUrl } = await res.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to initiate connection:', error);
      setIsConnecting(false);
    }
  };

  const handlePrev = () => {
    setCurrentDate(prev => addDays(prev, viewMode === 'day' ? -1 : -7));
  };

  const handleNext = () => {
    setCurrentDate(prev => addDays(prev, viewMode === 'day' ? 1 : 7));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getEventsForDay = (day: Date, allDayOnly = false) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start);
      const isAllDay = event.allDay || !event.start.includes('T');
      if (allDayOnly) return isSameDay(eventStart, day) && isAllDay;
      return isSameDay(eventStart, day) && !isAllDay;
    });
  };

  const getAllDayEventsForDay = (day: Date) => getEventsForDay(day, true);
  const getTimedEventsForDay = (day: Date) => getEventsForDay(day, false);

  const getEventStyle = (event: CalendarEvent) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);
    const startTime = start.getHours() + start.getMinutes() / 60;
    const endTime = end.getHours() + end.getMinutes() / 60;
    
    const topY = getYPosition(startTime);
    const bottomY = getYPosition(endTime);
    
    return {
      top: `${topY}px`,
      height: `${Math.max(bottomY - topY, 16)}px`,
    };
  };

  const startEventResize = (event: CalendarEvent, edge: 'top' | 'bottom', e: React.MouseEvent) => {
    e.stopPropagation();
    setResizingEvent({
      id: event.id,
      edge,
      startY: e.clientY,
      originalStart: parseISO(event.start),
      originalEnd: parseISO(event.end),
    });
  };

  const startEventDrag = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingEvent({
      id: event.id,
      startY: e.clientY,
      startX: e.clientX,
      originalStart: parseISO(event.start),
      originalEnd: parseISO(event.end),
    });
  };

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't open details if we were dragging
    if (!draggingEvent && !resizingEvent) {
      setSelectedEvent(event);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (onEventDelete) {
      try {
        await onEventDelete(eventId);
        setEvents(prev => prev.filter(e => e.id !== eventId));
      } catch (error) {
        console.error('Failed to delete event:', error);
      }
    }
  };

  // Softer priority colors for task-linked events
  const getPriorityColorStyle = (priority?: string): { bg: string; border: string } => {
    // Custom soft palette: coral, amber, calm blue, sage
    switch (priority) {
      case 'urgent': return { bg: 'rgba(232, 119, 119, 0.25)', border: '#e87777' }; // Soft coral
      case 'high': return { bg: 'rgba(230, 168, 85, 0.25)', border: '#e6a855' };    // Warm amber
      case 'medium': return { bg: 'rgba(107, 156, 212, 0.25)', border: '#6b9cd4' }; // Calm blue
      case 'low': return { bg: 'rgba(107, 156, 122, 0.25)', border: '#6b9c7a' };    // Sage green
      default: return { bg: 'rgba(100, 116, 139, 0.25)', border: '#64748b' };       // Soft slate
    }
  };

  // Soft, harmonious color palette for calendar events
  // Replaces harsh Google Calendar colors with muted, cohesive tones
  const getGoogleEventColor = (colorId?: string) => {
    const colors: Record<string, { bg: string; border: string }> = {
      // Map all Google colorIds to our soft palette
      '1': { bg: 'rgba(100, 116, 139, 0.25)', border: '#64748b' },  // Soft slate blue
      '2': { bg: 'rgba(107, 144, 128, 0.25)', border: '#6b9080' },  // Sage
      '3': { bg: 'rgba(190, 107, 122, 0.25)', border: '#be6b7a' },  // Muted rose
      '4': { bg: 'rgba(190, 107, 122, 0.25)', border: '#be6b7a' },  // Muted rose
      '5': { bg: 'rgba(212, 165, 116, 0.25)', border: '#d4a574' },  // Soft amber
      '6': { bg: 'rgba(230, 168, 85, 0.25)', border: '#e6a855' },   // Warm amber
      '7': { bg: 'rgba(124, 180, 196, 0.25)', border: '#7cb4c4' },  // Soft sky
      '8': { bg: 'rgba(100, 116, 139, 0.25)', border: '#64748b' },  // Soft slate
      '9': { bg: 'rgba(107, 156, 212, 0.25)', border: '#6b9cd4' },  // Calm blue
      '10': { bg: 'rgba(107, 156, 122, 0.25)', border: '#6b9c7a' }, // Sage green
      '11': { bg: 'rgba(232, 119, 119, 0.25)', border: '#e87777' }, // Soft coral
    };
    return colors[colorId || ''] || { bg: 'rgba(100, 116, 139, 0.25)', border: '#64748b' }; // Default: soft slate
  };

  const getEventColorStyle = (event: CalendarEvent) => {
    // If linked to a task, use task priority color
    if (event.task?.priority) {
      const color = getPriorityColorStyle(event.task.priority);
      return { style: { backgroundColor: color.bg, borderLeftColor: color.border } };
    }
    // Otherwise use Google Calendar color (mapped to soft palette)
    const color = getGoogleEventColor(event.color);
    return { style: { backgroundColor: color.bg, borderLeftColor: color.border } };
  };

  // Time slot drop target for tasks
  const TimeSlot = ({ day, hour }: { day: Date; hour: number }) => {
    const slotId = `calendar-slot-${day.toISOString()}-${hour}`;
    const { setNodeRef, isOver } = useDroppable({
      id: slotId,
      data: {
        type: 'calendar-slot',
        day,
        hour,
      },
    });

    const handleClick = () => {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = addHours(start, 1);
      setNewEventData({ start, end });
      setNewEventTitle('');
      setNewEventRecurrence('none');
      setShowCreateModal(true);
    };

    const height = getHourHeight(hour);

    return (
      <div
        ref={setNodeRef}
        onClick={handleClick}
        style={{ height: `${height}px` }}
        className={`border-b border-white/5 cursor-pointer ${
          isOver ? 'bg-violet-500/20' : ''
        }`}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      style={{ width: isOpen ? `${width}px` : 0 }}
      className={`fixed right-0 top-0 h-full bg-[#0f0f1a] border-l border-white/10 shadow-2xl z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${isResizing ? '' : 'transition-all duration-300'}`}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={() => setIsResizing(true)}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-violet-500/30 transition-colors group flex items-center justify-center"
      >
        <div className="w-1 h-16 bg-white/20 rounded group-hover:bg-violet-400 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 ml-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-violet-400" />
          <h2 className="font-semibold text-white">Calendar</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-[calc(100%-60px)] p-6">
          <Calendar className="w-16 h-16 text-violet-400/50 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect Your Calendar</h3>
          <p className="text-white/50 text-sm text-center mb-6">
            Connect Google Calendar to schedule time blocks for your tasks.
          </p>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <img src="/google-icon.svg" alt="Google" className="w-4 h-4" />
            )}
            Connect Google Calendar
          </button>
        </div>
      ) : (
        <>
          {/* Navigation */}
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-white/60" />
              </button>
              <button
                onClick={handleToday}
                className="px-2 py-1 text-xs font-medium text-white/70 hover:bg-white/10 rounded transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-white/60" />
              </button>
            </div>
            
            <span className="text-sm font-medium text-white">
              {viewMode === 'day' 
                ? format(currentDate, 'MMM d, yyyy')
                : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
              }
            </span>

            <div className="flex bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('day')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  viewMode === 'day' ? 'bg-violet-600 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  viewMode === 'week' ? 'bg-violet-600 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              </div>
            ) : viewMode === 'day' ? (
              /* Day View */
              <div className="flex flex-col h-full">
                {/* All-day events section */}
                {getAllDayEventsForDay(currentDate).length > 0 && (
                  <div className="border-b border-white/10 p-2 bg-[#0f0f1a]/50">
                    <span className="text-[10px] text-white/40 mb-1 block">ALL DAY</span>
                    <div className="flex flex-wrap gap-1">
                      {getAllDayEventsForDay(currentDate).map(event => {
                        const colorStyle = getEventColorStyle(event);
                        return (
                          <div
                            key={event.id}
                            className="border-l-2 px-2 py-1 rounded text-xs"
                            style={colorStyle.style}
                            title={event.title}
                          >
                            <span className="font-medium text-white">{event.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Time grid */}
                <div className="relative flex-1 overflow-auto">
                  {/* Time labels */}
                  <div className="absolute left-0 top-0 w-12 bg-[#0f0f1a] z-10">
                    {HOURS.map(hour => (
                      <div 
                        key={hour} 
                        style={{ height: `${getHourHeight(hour)}px` }}
                        className="flex items-start justify-end pr-2 pt-1"
                      >
                        <span className="text-[10px] text-white/40">
                          {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Time slots */}
                  <div className="ml-12 relative">
                    {HOURS.map(hour => (
                      <TimeSlot key={hour} day={currentDate} hour={hour} />
                    ))}
                    
                    {/* Timed Events */}
                    {getTimedEventsForDay(currentDate).map(event => {
                      const colorStyle = getEventColorStyle(event);
                      return (
                        <div
                          key={event.id}
                          className="absolute left-1 right-1 rounded border-l-2 group cursor-grab overflow-visible"
                          style={{ ...getEventStyle(event), ...colorStyle.style }}
                          onMouseDown={(e) => startEventDrag(event, e)}
                          onClick={(e) => handleEventClick(event, e)}
                        >
                          {/* Top resize handle */}
                          <div 
                            className="absolute -top-2 left-[40%] right-[40%] h-3 cursor-ns-resize bg-transparent hover:bg-white/20 z-20 flex items-center justify-center"
                            onMouseDown={(e) => startEventResize(event, 'top', e)}
                          >
                            <div className="w-8 h-1 bg-white rounded" />
                          </div>
                          
                          {/* Delete button - 2px */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this event?')) {
                                handleDeleteEvent(event.id);
                              }
                            }}
                            className="absolute top-0.5 right-0.5 w-[2px] h-[2px] rounded-sm bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                          />
                          
                          <div className="flex items-center gap-1 pr-5 px-2 pt-2">
                            <span className="text-xs font-medium text-white truncate">
                              {event.title}
                            </span>
                            {event.task && (
                              <Link2 className="w-3 h-3 text-violet-400 flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-white/50 px-2">
                            {format(parseISO(event.start), 'h:mm a')}
                          </span>
                          
                          {/* Bottom resize handle */}
                          <div 
                            className="absolute -bottom-2 left-[40%] right-[40%] h-3 cursor-ns-resize bg-transparent hover:bg-white/20 z-20 flex items-center justify-center"
                            onMouseDown={(e) => startEventResize(event, 'bottom', e)}
                          >
                            <div className="w-8 h-1 bg-white rounded" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Week View */
              <div className="flex flex-col">
                {/* All-day events row */}
                <div className="flex border-b border-white/10">
                  <div className="w-10 flex-shrink-0 bg-[#0f0f1a] flex items-center justify-end pr-1">
                    <span className="text-[8px] text-white/40">ALL</span>
                  </div>
                  {weekDays.map(day => {
                    const allDayEvents = getAllDayEventsForDay(day);
                    return (
                      <div key={`allday-${day.toISOString()}`} className="flex-1 border-l border-white/5 min-h-[30px] p-0.5">
                        {allDayEvents.map(event => {
                          const colorStyle = getEventColorStyle(event);
                          return (
                            <div
                              key={event.id}
                              className="border-l-2 px-1 py-0.5 rounded text-[9px] mb-0.5 truncate"
                              style={colorStyle.style}
                              title={event.title}
                            >
                              <span className="font-medium text-white">{event.title}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                <div className="flex flex-1 overflow-auto">
                  {/* Time labels */}
                  <div className="w-10 flex-shrink-0 bg-[#0f0f1a]">
                    <div className="h-8" /> {/* Header spacer */}
                    {HOURS.map(hour => (
                      <div 
                        key={hour} 
                        style={{ height: `${getHourHeight(hour)}px` }}
                        className="flex items-start justify-end pr-1 pt-1"
                      >
                        <span className="text-[9px] text-white/40">
                          {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Days */}
                  {weekDays.map(day => (
                    <div key={day.toISOString()} className="flex-1 border-l border-white/5">
                      {/* Day header */}
                      <div className={`h-8 flex flex-col items-center justify-center border-b border-white/10 ${
                        isSameDay(day, new Date()) ? 'bg-violet-600/20' : ''
                      }`}>
                        <span className="text-[10px] text-white/50">{format(day, 'EEE')}</span>
                        <span className={`text-xs font-medium ${
                          isSameDay(day, new Date()) ? 'text-violet-400' : 'text-white/70'
                        }`}>{format(day, 'd')}</span>
                      </div>
                      
                      {/* Time slots */}
                      <div className="relative">
                        {HOURS.map(hour => (
                          <TimeSlot key={hour} day={day} hour={hour} />
                        ))}
                        
                        {/* Timed Events */}
                        {getTimedEventsForDay(day).map(event => {
                          const colorStyle = getEventColorStyle(event);
                          return (
                            <div
                              key={event.id}
                              className="absolute left-0.5 right-0.5 rounded text-[10px] border-l-2 overflow-visible group cursor-grab"
                              style={{ ...getEventStyle(event), ...colorStyle.style }}
                              title={event.title}
                              onMouseDown={(e) => startEventDrag(event, e)}
                              onClick={(e) => handleEventClick(event, e)}
                            >
                              {/* Top resize handle */}
                              <div 
                                className="absolute -top-1 left-[40%] right-[40%] h-2 cursor-ns-resize bg-transparent hover:bg-white/20 z-20 flex items-center justify-center"
                                onMouseDown={(e) => startEventResize(event, 'top', e)}
                              >
                                <div className="w-4 h-0.5 bg-white rounded" />
                              </div>
                              
                              {/* Delete button - 2px */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this event?')) {
                                    handleDeleteEvent(event.id);
                                  }
                                }}
                                className="absolute top-0 right-0 w-[2px] h-[2px] rounded-sm bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                              />
                              
                              <span className="font-medium text-white truncate block px-1 pt-1 pr-4">
                                {event.title}
                              </span>
                              
                              {/* Bottom resize handle */}
                              <div 
                                className="absolute -bottom-1 left-[40%] right-[40%] h-2 cursor-ns-resize bg-transparent hover:bg-white/20 z-20 flex items-center justify-center"
                                onMouseDown={(e) => startEventResize(event, 'bottom', e)}
                              >
                                <div className="w-4 h-0.5 bg-white rounded" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Event Creation Modal */}
      {showCreateModal && newEventData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowCreateModal(false)}>
          <div className="bg-slate-800 rounded-lg p-4 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-medium mb-3">New Event</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Event title..."
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="text-xs text-slate-400 block mb-1">Time</label>
                <p className="text-sm text-white">
                  {format(newEventData.start, 'EEE, MMM d')} at {format(newEventData.start, 'h:mm a')} - {format(newEventData.end, 'h:mm a')}
                </p>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 block mb-1">Repeat</label>
                <select
                  value={newEventRecurrence}
                  onChange={(e) => setNewEventRecurrence(e.target.value as typeof newEventRecurrence)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newEventTitle.trim()) {
                    onEventCreate?.({
                      title: newEventTitle,
                      start: newEventData.start,
                      end: newEventData.end,
                      recurrence: newEventRecurrence !== 'none' ? { frequency: newEventRecurrence } : undefined,
                    });
                    setShowCreateModal(false);
                  }
                }}
                disabled={!newEventTitle.trim()}
                className="flex-1 px-3 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setSelectedEvent(null)}>
          <div className="bg-slate-800 rounded-lg p-4 w-96 shadow-xl max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-white font-medium text-lg pr-4">{selectedEvent.title}</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              {/* Time */}
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>
                  {format(parseISO(selectedEvent.start), 'EEE, MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 ml-6">
                <span>
                  {format(parseISO(selectedEvent.start), 'h:mm a')} - {format(parseISO(selectedEvent.end), 'h:mm a')}
                </span>
              </div>
              
              {/* Description */}
              {selectedEvent.description && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-slate-300 whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              )}
              
              {/* Linked Task */}
              {selectedEvent.task && (
                <div className="mt-4 p-2 bg-slate-700/50 rounded">
                  <p className="text-xs text-slate-500 mb-1">Linked Task</p>
                  <div className="flex items-center gap-2">
                    <Link2 className="w-3 h-3 text-violet-400" />
                    <span className="text-white">{selectedEvent.task.title}</span>
                    {selectedEvent.task.priority && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        selectedEvent.task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                        selectedEvent.task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        selectedEvent.task.priority === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {selectedEvent.task.priority}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Open in Google Calendar */}
              {selectedEvent.htmlLink && (
                <a
                  href={selectedEvent.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 text-violet-400 hover:text-violet-300 text-sm"
                >
                  Open in Google Calendar →
                </a>
              )}
            </div>
            
            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => {
                  if (confirm('Delete this event?')) {
                    handleDeleteEvent(selectedEvent.id);
                    setSelectedEvent(null);
                  }
                }}
                className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
              >
                Delete
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
