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
  onEventCreate?: (event: { taskId?: string; start: Date; end: Date }) => void;
  onEventUpdate?: (eventId: string, updates: { start?: Date; end?: Date }) => void;
  onWidthChange?: (width: number) => void;
  initialWidth?: number;
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

export default function CalendarPanel({ isOpen, onClose, onEventCreate, onEventUpdate, onWidthChange, initialWidth = DEFAULT_WIDTH }: CalendarPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingEvent, setResizingEvent] = useState<{ id: string; edge: 'top' | 'bottom'; startY: number; originalStart: Date; originalEnd: Date } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
      const deltaHours = deltaY / HOUR_HEIGHT;
      
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

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
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
  }, [isOpen, fetchEvents]);

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

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 border-red-500';
      case 'high': return 'bg-orange-500/20 border-orange-500';
      case 'medium': return 'bg-yellow-500/20 border-yellow-500';
      case 'low': return 'bg-green-500/20 border-green-500';
      default: return 'bg-violet-500/20 border-violet-500';
    }
  };

  // Google Calendar color mapping
  const getGoogleEventColor = (colorId?: string) => {
    const colors: Record<string, { bg: string; border: string }> = {
      '1': { bg: 'rgba(121, 134, 203, 0.3)', border: '#7986cb' },  // Lavender
      '2': { bg: 'rgba(51, 182, 121, 0.3)', border: '#33b679' },   // Sage
      '3': { bg: 'rgba(142, 36, 170, 0.3)', border: '#8e24aa' },   // Grape
      '4': { bg: 'rgba(230, 124, 115, 0.3)', border: '#e67c73' },  // Flamingo
      '5': { bg: 'rgba(246, 192, 38, 0.3)', border: '#f6c026' },   // Banana
      '6': { bg: 'rgba(245, 81, 29, 0.3)', border: '#f5511d' },    // Tangerine
      '7': { bg: 'rgba(3, 155, 229, 0.3)', border: '#039be5' },    // Peacock
      '8': { bg: 'rgba(97, 97, 97, 0.3)', border: '#616161' },     // Graphite
      '9': { bg: 'rgba(63, 81, 181, 0.3)', border: '#3f51b5' },    // Blueberry
      '10': { bg: 'rgba(11, 128, 67, 0.3)', border: '#0b8043' },   // Basil
      '11': { bg: 'rgba(214, 0, 0, 0.3)', border: '#d60000' },     // Tomato
    };
    return colors[colorId || ''] || { bg: 'rgba(3, 155, 229, 0.3)', border: '#039be5' }; // Default to Peacock blue
  };

  const getEventColorStyle = (event: CalendarEvent) => {
    // If linked to a task, use task priority color
    if (event.task?.priority) {
      return { className: getPriorityColor(event.task.priority) };
    }
    // Otherwise use Google Calendar color
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
      onEventCreate?.({ start, end });
    };

    const height = getHourHeight(hour);

    return (
      <div
        ref={setNodeRef}
        onClick={handleClick}
        style={{ height: `${height}px` }}
        className={`border-b border-white/5 transition-colors cursor-pointer ${
          isOver ? 'bg-violet-500/30' : 'hover:bg-white/5'
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
                      {getAllDayEventsForDay(currentDate).map(event => (
                        <div
                          key={event.id}
                          className="bg-green-500/30 border-l-2 border-green-500 px-2 py-1 rounded text-xs"
                          title={event.title}
                        >
                          <span className="font-medium text-white">{event.title}</span>
                        </div>
                      ))}
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
                          className={`absolute left-1 right-1 px-2 py-1 rounded border-l-2 group ${colorStyle.className || ''}`}
                          style={{ ...getEventStyle(event), ...colorStyle.style }}
                        >
                          {/* Top resize handle */}
                          <div 
                            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 bg-white/20 rounded-t"
                            onMouseDown={(e) => startEventResize(event, 'top', e)}
                          />
                          
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-white truncate">
                              {event.title}
                            </span>
                            {event.task && (
                              <Link2 className="w-3 h-3 text-violet-400 flex-shrink-0" />
                            )}
                          </div>
                          <span className="text-[10px] text-white/50">
                            {format(parseISO(event.start), 'h:mm a')}
                          </span>
                          
                          {/* Bottom resize handle */}
                          <div 
                            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 bg-white/20 rounded-b"
                            onMouseDown={(e) => startEventResize(event, 'bottom', e)}
                          />
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
                        {allDayEvents.map(event => (
                          <div
                            key={event.id}
                            className="bg-green-500/30 border-l-2 border-green-500 px-1 py-0.5 rounded text-[9px] mb-0.5 truncate"
                            title={event.title}
                          >
                            <span className="font-medium text-white">{event.title}</span>
                          </div>
                        ))}
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
                              className={`absolute left-0.5 right-0.5 px-1 py-0.5 rounded text-[10px] border-l-2 overflow-hidden ${colorStyle.className || ''}`}
                              style={{ ...getEventStyle(event), ...colorStyle.style }}
                              title={event.title}
                            >
                              <span className="font-medium text-white truncate block">
                                {event.title}
                              </span>
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
    </div>
  );
}
