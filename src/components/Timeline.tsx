"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  format,
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  differenceInDays,
  differenceInHours,
  isSameDay,
  isWithinInterval,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
} from "date-fns";
import clsx from "clsx";
import type { Task, Column, Priority } from "@/types";

type TimeScale = "day" | "week" | "month";

interface TimelineTask extends Task {
  column?: Column;
}

interface TimelineProps {
  tasks: TimelineTask[];
  columns: Column[];
  onTaskClick: (task: Task) => void;
  onTaskMove?: (taskId: string, startDate: Date, dueDate: Date) => void;
}

const priorityColors: Record<Priority, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

const priorityBorderColors: Record<Priority, string> = {
  low: "border-green-600",
  medium: "border-blue-600",
  high: "border-amber-600",
  urgent: "border-red-600",
};

export function Timeline({ tasks, columns, onTaskClick, onTaskMove }: TimelineProps) {
  const [timeScale, setTimeScale] = useState<TimeScale>("week");
  const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [draggingTask, setDraggingTask] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"move" | "resize-start" | "resize-end" | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [dragEndDate, setDragEndDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Calculate date range based on scale
  const { dateRange, cellWidth, cellCount } = useMemo(() => {
    let end: Date;
    let width: number;
    let count: number;

    switch (timeScale) {
      case "day":
        end = addDays(viewStart, 14);
        width = 80; // pixels per day
        count = 14;
        break;
      case "week":
        end = addWeeks(viewStart, 8);
        width = 120; // pixels per week
        count = 8;
        break;
      case "month":
        end = addMonths(viewStart, 6);
        width = 180; // pixels per month
        count = 6;
        break;
      default:
        end = addWeeks(viewStart, 8);
        width = 120;
        count = 8;
    }

    return {
      dateRange: { start: viewStart, end },
      cellWidth: width,
      cellCount: count,
    };
  }, [viewStart, timeScale]);

  // Generate time cells (columns)
  const timeCells = useMemo(() => {
    switch (timeScale) {
      case "day":
        return eachDayOfInterval(dateRange);
      case "week":
        return eachWeekOfInterval(dateRange, { weekStartsOn: 1 });
      case "month":
        return eachMonthOfInterval(dateRange);
      default:
        return eachDayOfInterval(dateRange);
    }
  }, [dateRange, timeScale]);

  // Separate scheduled and unscheduled tasks
  const { scheduledTasks, unscheduledTasks } = useMemo(() => {
    const scheduled: TimelineTask[] = [];
    const unscheduled: TimelineTask[] = [];

    tasks.forEach((task) => {
      if (task.startDate || task.dueDate) {
        scheduled.push(task);
      } else {
        unscheduled.push(task);
      }
    });

    return { scheduledTasks: scheduled, unscheduledTasks: unscheduled };
  }, [tasks]);

  // Group tasks by column for row display
  const tasksByColumn = useMemo(() => {
    const grouped = new Map<string, TimelineTask[]>();
    columns.forEach((col) => {
      grouped.set(col.id, []);
    });
    scheduledTasks.forEach((task) => {
      const existing = grouped.get(task.columnId) || [];
      grouped.set(task.columnId, [...existing, task]);
    });
    return grouped;
  }, [scheduledTasks, columns]);

  // Calculate task position and width
  const getTaskStyle = useCallback(
    (task: TimelineTask) => {
      const taskStart = task.startDate
        ? new Date(task.startDate)
        : task.dueDate
        ? new Date(task.dueDate)
        : null;
      const taskEnd = task.dueDate
        ? new Date(task.dueDate)
        : task.startDate
        ? new Date(task.startDate)
        : null;

      if (!taskStart || !taskEnd) return { left: 0, width: 0, visible: false };

      // Handle dragging state
      const displayStart = draggingTask === task.id && dragStartDate ? dragStartDate : taskStart;
      const displayEnd = draggingTask === task.id && dragEndDate ? dragEndDate : taskEnd;

      let left: number;
      let width: number;

      switch (timeScale) {
        case "day": {
          const startDiff = differenceInDays(displayStart, viewStart);
          const duration = Math.max(1, differenceInDays(displayEnd, displayStart) + 1);
          left = startDiff * cellWidth;
          width = duration * cellWidth - 4;
          break;
        }
        case "week": {
          const startDiff = differenceInDays(displayStart, viewStart) / 7;
          const duration = Math.max(1, differenceInDays(displayEnd, displayStart) + 1) / 7;
          left = startDiff * cellWidth;
          width = Math.max(cellWidth / 7, duration * cellWidth - 4);
          break;
        }
        case "month": {
          const startDiff = differenceInDays(displayStart, viewStart) / 30;
          const duration = Math.max(1, differenceInDays(displayEnd, displayStart) + 1) / 30;
          left = startDiff * cellWidth;
          width = Math.max(cellWidth / 30, duration * cellWidth - 4);
          break;
        }
      }

      // Check if visible in current range
      const visible =
        displayEnd >= dateRange.start && displayStart <= dateRange.end;

      return { left, width, visible };
    },
    [viewStart, timeScale, cellWidth, dateRange, draggingTask, dragStartDate, dragEndDate]
  );

  // Get today marker position
  const todayPosition = useMemo(() => {
    const today = new Date();
    switch (timeScale) {
      case "day":
        return differenceInDays(today, viewStart) * cellWidth + cellWidth / 2;
      case "week":
        return (differenceInDays(today, viewStart) / 7) * cellWidth;
      case "month":
        return (differenceInDays(today, viewStart) / 30) * cellWidth;
    }
  }, [viewStart, timeScale, cellWidth]);

  // Navigation handlers
  const navigatePrev = () => {
    switch (timeScale) {
      case "day":
        setViewStart(addDays(viewStart, -7));
        break;
      case "week":
        setViewStart(addWeeks(viewStart, -4));
        break;
      case "month":
        setViewStart(addMonths(viewStart, -3));
        break;
    }
  };

  const navigateNext = () => {
    switch (timeScale) {
      case "day":
        setViewStart(addDays(viewStart, 7));
        break;
      case "week":
        setViewStart(addWeeks(viewStart, 4));
        break;
      case "month":
        setViewStart(addMonths(viewStart, 3));
        break;
    }
  };

  const goToToday = () => {
    switch (timeScale) {
      case "day":
        setViewStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
        break;
      case "week":
        setViewStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
        break;
      case "month":
        setViewStart(startOfMonth(new Date()));
        break;
    }
    // Scroll to today
    setTimeout(() => {
      if (timelineRef.current) {
        timelineRef.current.scrollLeft = Math.max(0, todayPosition - 200);
      }
    }, 100);
  };

  // Drag handlers
  const handleDragStart = (
    e: React.MouseEvent,
    task: TimelineTask,
    type: "move" | "resize-start" | "resize-end"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingTask(task.id);
    setDragType(type);
    setDragStartX(e.clientX);
    setDragStartDate(task.startDate ? new Date(task.startDate) : task.dueDate ? new Date(task.dueDate) : new Date());
    setDragEndDate(task.dueDate ? new Date(task.dueDate) : task.startDate ? new Date(task.startDate) : new Date());
  };

  useEffect(() => {
    if (!draggingTask) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX;
      let deltaDays: number;

      switch (timeScale) {
        case "day":
          deltaDays = Math.round(deltaX / cellWidth);
          break;
        case "week":
          deltaDays = Math.round((deltaX / cellWidth) * 7);
          break;
        case "month":
          deltaDays = Math.round((deltaX / cellWidth) * 30);
          break;
      }

      const task = tasks.find((t) => t.id === draggingTask);
      if (!task) return;

      const origStart = task.startDate ? new Date(task.startDate) : task.dueDate ? new Date(task.dueDate) : new Date();
      const origEnd = task.dueDate ? new Date(task.dueDate) : task.startDate ? new Date(task.startDate) : new Date();

      switch (dragType) {
        case "move":
          setDragStartDate(addDays(origStart, deltaDays));
          setDragEndDate(addDays(origEnd, deltaDays));
          break;
        case "resize-start":
          const newStart = addDays(origStart, deltaDays);
          if (newStart <= origEnd) {
            setDragStartDate(newStart);
          }
          break;
        case "resize-end":
          const newEnd = addDays(origEnd, deltaDays);
          if (newEnd >= origStart) {
            setDragEndDate(newEnd);
          }
          break;
      }
    };

    const handleMouseUp = () => {
      if (draggingTask && dragStartDate && dragEndDate && onTaskMove) {
        onTaskMove(draggingTask, dragStartDate, dragEndDate);
      }
      setDraggingTask(null);
      setDragType(null);
      setDragStartX(0);
      setDragStartDate(null);
      setDragEndDate(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingTask, dragType, dragStartX, cellWidth, timeScale, tasks, dragStartDate, dragEndDate, onTaskMove]);

  // Handle dropping unscheduled task
  const handleTimelineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId || !timelineRef.current || !onTaskMove) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    
    let date: Date;
    switch (timeScale) {
      case "day":
        date = addDays(viewStart, Math.floor(x / cellWidth));
        break;
      case "week":
        date = addDays(viewStart, Math.floor((x / cellWidth) * 7));
        break;
      case "month":
        date = addDays(viewStart, Math.floor((x / cellWidth) * 30));
        break;
    }

    onTaskMove(taskId, date, addDays(date, 1));
  };

  const formatCellHeader = (date: Date) => {
    switch (timeScale) {
      case "day":
        return (
          <div className="text-center">
            <div className="text-xs text-slate-500">{format(date, "EEE")}</div>
            <div className={clsx(
              "text-sm font-medium",
              isSameDay(date, new Date()) ? "text-indigo-400" : "text-slate-300"
            )}>
              {format(date, "d")}
            </div>
          </div>
        );
      case "week":
        return (
          <div className="text-center">
            <div className="text-xs text-slate-500">{format(date, "MMM")}</div>
            <div className="text-sm font-medium text-slate-300">
              Week {format(date, "w")}
            </div>
          </div>
        );
      case "month":
        return (
          <div className="text-center">
            <div className="text-sm font-medium text-slate-300">
              {format(date, "MMMM yyyy")}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 bg-slate-800/50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-white font-medium min-w-[140px] text-center">
            {format(viewStart, "MMM yyyy")}
          </span>
          <button
            onClick={navigateNext}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Time scale toggle */}
          <div className="flex items-center bg-slate-700 rounded-lg p-0.5">
            {(["day", "week", "month"] as TimeScale[]).map((scale) => (
              <button
                key={scale}
                onClick={() => setTimeScale(scale)}
                className={clsx(
                  "px-3 py-1.5 text-sm rounded-md transition-colors capitalize",
                  timeScale === scale
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {scale}
              </button>
            ))}
          </div>

          <button
            onClick={goToToday}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-lg border border-slate-700">
        {/* Unscheduled sidebar */}
        <div className="w-48 shrink-0 bg-slate-800/50 border-r border-slate-700 flex flex-col">
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-slate-300">Unscheduled</h3>
            <p className="text-xs text-slate-500">{unscheduledTasks.length} tasks</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {unscheduledTasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("taskId", task.id);
                }}
                onClick={() => onTaskClick(task)}
                className={clsx(
                  "p-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-grab transition-colors",
                  "border-l-4",
                  priorityBorderColors[task.priority as Priority]
                )}
              >
                <p className="text-sm text-white truncate">{task.title}</p>
                {task.column && (
                  <p className="text-xs text-slate-400 mt-1">{task.column.name}</p>
                )}
              </div>
            ))}
            {unscheduledTasks.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">
                No unscheduled tasks
              </p>
            )}
          </div>
        </div>

        {/* Timeline grid */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleTimelineDrop}
        >
          <div style={{ minWidth: cellCount * cellWidth + 200 }}>
            {/* Time header */}
            <div className="sticky top-0 z-20 flex border-b border-slate-700 bg-slate-800">
              <div className="w-48 shrink-0 p-3 border-r border-slate-700 bg-slate-800">
                <span className="text-sm font-medium text-slate-400">Status</span>
              </div>
              <div className="flex">
                {timeCells.map((date, i) => (
                  <div
                    key={i}
                    className={clsx(
                      "shrink-0 p-2 border-r border-slate-700/50",
                      isSameDay(date, new Date()) && timeScale === "day" && "bg-indigo-900/20"
                    )}
                    style={{ width: cellWidth }}
                  >
                    {formatCellHeader(date)}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows by column/status */}
            {columns.map((column) => {
              const columnTasks = tasksByColumn.get(column.id) || [];
              const rowHeight = Math.max(48, columnTasks.length * 36 + 12);

              return (
                <div
                  key={column.id}
                  className="flex border-b border-slate-700/50 hover:bg-slate-800/30"
                  style={{ minHeight: rowHeight }}
                >
                  {/* Row header */}
                  <div className="w-48 shrink-0 p-3 border-r border-slate-700 flex items-start gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: column.color }}
                    />
                    <span className="text-sm text-slate-300">{column.name}</span>
                    <span className="text-xs text-slate-500">({columnTasks.length})</span>
                  </div>

                  {/* Task bars */}
                  <div className="flex-1 relative">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {timeCells.map((date, i) => (
                        <div
                          key={i}
                          className="shrink-0 border-r border-slate-700/30"
                          style={{ width: cellWidth }}
                        />
                      ))}
                    </div>

                    {/* Today marker */}
                    {todayPosition > 0 && todayPosition < cellCount * cellWidth && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                        style={{ left: todayPosition }}
                      />
                    )}

                    {/* Task bars */}
                    <div className="relative p-1">
                      {columnTasks.map((task, idx) => {
                        const style = getTaskStyle(task);
                        if (!style.visible) return null;

                        return (
                          <div
                            key={task.id}
                            className={clsx(
                              "absolute h-8 rounded-md flex items-center gap-2 px-2 cursor-pointer group transition-all",
                              priorityColors[task.priority as Priority],
                              draggingTask === task.id && "opacity-70 shadow-lg z-30",
                              "hover:shadow-lg hover:z-20"
                            )}
                            style={{
                              left: style.left,
                              width: Math.max(40, style.width),
                              top: idx * 36 + 4,
                            }}
                            onClick={() => onTaskClick(task)}
                          >
                            {/* Resize handle - start */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-l-md"
                              onMouseDown={(e) => handleDragStart(e, task, "resize-start")}
                            />

                            {/* Task content */}
                            <div
                              className="flex-1 flex items-center gap-2 overflow-hidden cursor-grab"
                              onMouseDown={(e) => handleDragStart(e, task, "move")}
                            >
                              <span className="text-xs text-white font-medium truncate">
                                {task.title}
                              </span>
                            </div>

                            {/* Assignee */}
                            {task.assignee && (
                              <div className="shrink-0">
                                {task.assignee.image ? (
                                  <Image
                                    src={task.assignee.image}
                                    alt={task.assignee.name || ""}
                                    width={20}
                                    height={20}
                                    className="rounded-full border border-white/20"
                                  />
                                ) : (
                                  <div className="w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center text-[10px] text-white border border-white/20">
                                    {(task.assignee.name || task.assignee.email)?.[0]?.toUpperCase()}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Resize handle - end */}
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-r-md"
                              onMouseDown={(e) => handleDragStart(e, task, "resize-end")}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading skeleton for Timeline
export function TimelineSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between mb-4 bg-slate-800/50 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-700 rounded-lg" />
          <div className="w-24 h-6 bg-slate-700 rounded" />
          <div className="w-8 h-8 bg-slate-700 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-32 h-8 bg-slate-700 rounded-lg" />
          <div className="w-16 h-8 bg-slate-700 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-lg border border-slate-700">
        {/* Sidebar skeleton */}
        <div className="w-48 shrink-0 bg-slate-800/50 border-r border-slate-700">
          <div className="p-3 border-b border-slate-700">
            <div className="w-20 h-4 bg-slate-700 rounded mb-1" />
            <div className="w-12 h-3 bg-slate-700 rounded" />
          </div>
          <div className="p-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-2 bg-slate-700 rounded-lg">
                <div className="w-full h-4 bg-slate-600 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="flex-1">
          <div className="flex border-b border-slate-700 bg-slate-800">
            <div className="w-48 shrink-0 p-3 border-r border-slate-700">
              <div className="w-12 h-4 bg-slate-700 rounded" />
            </div>
            <div className="flex">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="w-[120px] p-2 border-r border-slate-700/50">
                  <div className="w-12 h-3 bg-slate-700 rounded mx-auto mb-1" />
                  <div className="w-16 h-4 bg-slate-700 rounded mx-auto" />
                </div>
              ))}
            </div>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex border-b border-slate-700/50 h-12">
              <div className="w-48 shrink-0 p-3 border-r border-slate-700 flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-700 rounded-full" />
                <div className="w-16 h-4 bg-slate-700 rounded" />
              </div>
              <div className="flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
