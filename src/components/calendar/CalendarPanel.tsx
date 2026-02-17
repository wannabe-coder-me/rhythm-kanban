'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek, endOfWeek, startOfDay, addHours, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, X, Calendar, Loader2, Link2, GripVertical } from 'lucide-react';

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
  onWidthChange?: (width: number) => void;
  initialWidth?: number;
}

type ViewMode = 'day' | 'week';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // pixels per hour

const MIN_WIDTH = 280;
const MAX_WIDTH = 1200;
const DEFAULT_WIDTH = 450;

export default function CalendarPanel({ isOpen, onClose, onEventCreate, onWidthChange, initialWidth = DEFAULT_WIDTH }: CalendarPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
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

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start);
      return isSameDay(eventStart, day);
    });
  };

  const getEventStyle = (event: CalendarEvent) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return {
      top: `${startHour * HOUR_HEIGHT}px`,
      height: `${Math.max(duration * HOUR_HEIGHT, 24)}px`,
    };
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

  // Time slot component (drag-drop to be added later)
  const TimeSlot = ({ day, hour }: { day: Date; hour: number }) => {
    const handleClick = () => {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = addHours(start, 1);
      // For now, just log - drag-drop to be implemented
      console.log('Time slot clicked:', { start, end });
    };

    return (
      <div
        onClick={handleClick}
        className="h-[60px] border-b border-white/5 transition-colors hover:bg-white/5 cursor-pointer"
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
              <div className="relative">
                {/* Time labels */}
                <div className="absolute left-0 top-0 w-12 bg-[#0f0f1a] z-10">
                  {HOURS.map(hour => (
                    <div key={hour} className="h-[60px] flex items-start justify-end pr-2 pt-1">
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
                  
                  {/* Events */}
                  {getEventsForDay(currentDate).map(event => (
                    <div
                      key={event.id}
                      className={`absolute left-1 right-1 px-2 py-1 rounded border-l-2 ${getPriorityColor(event.task?.priority)}`}
                      style={getEventStyle(event)}
                    >
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
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Week View */
              <div className="flex">
                {/* Time labels */}
                <div className="w-10 flex-shrink-0 bg-[#0f0f1a]">
                  <div className="h-8" /> {/* Header spacer */}
                  {HOURS.map(hour => (
                    <div key={hour} className="h-[60px] flex items-start justify-end pr-1 pt-1">
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
                      
                      {/* Events */}
                      {getEventsForDay(day).map(event => (
                        <div
                          key={event.id}
                          className={`absolute left-0.5 right-0.5 px-1 py-0.5 rounded text-[10px] border-l-2 overflow-hidden ${getPriorityColor(event.task?.priority)}`}
                          style={getEventStyle(event)}
                          title={event.title}
                        >
                          <span className="font-medium text-white truncate block">
                            {event.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
