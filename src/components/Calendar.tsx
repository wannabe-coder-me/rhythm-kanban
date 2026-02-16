"use client";

import { useState, useMemo, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import clsx from "clsx";
import type { Task, Priority } from "@/types";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";

const priorityColors: Record<Priority, string> = {
  low: "bg-green-500/80 hover:bg-green-500",
  medium: "bg-blue-500/80 hover:bg-blue-500",
  high: "bg-amber-500/80 hover:bg-amber-500",
  urgent: "bg-red-500/80 hover:bg-red-500",
};

const priorityBorderColors: Record<Priority, string> = {
  low: "border-l-green-500",
  medium: "border-l-blue-500",
  high: "border-l-amber-500",
  urgent: "border-l-red-500",
};

interface CalendarProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDateClick: (date: Date) => void;
  onTaskMove: (taskId: string, newDueDate: Date) => void;
}

interface DraggableTaskProps {
  task: Task;
  onClick: () => void;
}

function DraggableTask({ task, onClick }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        "text-xs px-2 py-1 rounded truncate cursor-pointer border-l-2 transition-all",
        priorityBorderColors[task.priority as Priority],
        "bg-slate-700/80 hover:bg-slate-600 text-white",
        isDragging && "opacity-50"
      )}
      title={task.title}
    >
      {task.title}
    </div>
  );
}

interface DroppableDayProps {
  date: Date;
  isCurrentMonth: boolean;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDateClick: (date: Date) => void;
  maxTasks?: number;
}

function DroppableDay({
  date,
  isCurrentMonth,
  tasks,
  onTaskClick,
  onDateClick,
  maxTasks = 3,
}: DroppableDayProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({
    id: dateStr,
    data: { date },
  });

  const displayedTasks = tasks.slice(0, maxTasks);
  const remainingCount = tasks.length - maxTasks;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onDateClick(date)}
      className={clsx(
        "min-h-[100px] p-1 border border-slate-700/50 cursor-pointer transition-colors",
        isCurrentMonth ? "bg-slate-800/50" : "bg-slate-900/30",
        isToday(date) && "ring-2 ring-indigo-500 ring-inset",
        isOver && "bg-indigo-500/20"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={clsx(
            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
            isToday(date)
              ? "bg-indigo-500 text-white"
              : isCurrentMonth
              ? "text-slate-300"
              : "text-slate-600"
          )}
        >
          {format(date, "d")}
        </span>
      </div>

      <div className="space-y-1">
        {displayedTasks.map((task) => (
          <DraggableTask
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
          />
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-slate-500 px-2 py-0.5 hover:text-slate-400">
            +{remainingCount} more
          </div>
        )}
      </div>
    </div>
  );
}

// Task pill for drag overlay
function TaskPill({ task }: { task: Task }) {
  return (
    <div
      className={clsx(
        "text-xs px-2 py-1 rounded border-l-2 bg-slate-700 text-white shadow-lg",
        priorityBorderColors[task.priority as Priority]
      )}
    >
      {task.title}
    </div>
  );
}

export function Calendar({
  tasks,
  onTaskClick,
  onDateClick,
  onTaskMove,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }

    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate, viewMode]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      if (task.dueDate) {
        const dateKey = format(new Date(task.dueDate), "yyyy-MM-dd");
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(task);
      }
    });
    return map;
  }, [tasks]);

  const handlePrevious = () => {
    setCurrentDate((prev) =>
      viewMode === "month"
        ? subMonths(prev, 1)
        : new Date(prev.setDate(prev.getDate() - 7))
    );
  };

  const handleNext = () => {
    setCurrentDate((prev) =>
      viewMode === "month"
        ? addMonths(prev, 1)
        : new Date(prev.setDate(prev.getDate() + 7))
    );
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id as string;
    const dateStr = over.id as string;

    // Parse the date from the droppable ID
    const newDate = new Date(dateStr + "T12:00:00");
    
    // Only update if the date is valid
    if (!isNaN(newDate.getTime())) {
      onTaskMove(taskId, newDate);
    }
  };

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white">
            {format(currentDate, viewMode === "month" ? "MMMM yyyy" : "'Week of' MMM d, yyyy")}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevious}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Today
          </button>
          
          {/* View Toggle */}
          <div className="flex bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("month")}
              className={clsx(
                "px-3 py-1 text-sm rounded-md transition-colors",
                viewMode === "month"
                  ? "bg-slate-600 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={clsx(
                "px-3 py-1 text-sm rounded-md transition-colors",
                viewMode === "week"
                  ? "bg-slate-600 text-white"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <span className="text-slate-500">Priority:</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-slate-400">Low</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-400">Medium</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-slate-400">High</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-slate-400">Urgent</span>
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex flex-col">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-px mb-px">
            {weekdays.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-medium text-slate-400 bg-slate-800"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div
            className={clsx(
              "flex-1 grid grid-cols-7 gap-px bg-slate-700/50",
              viewMode === "week" ? "grid-rows-1" : "auto-rows-fr"
            )}
          >
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <DroppableDay
                  key={dateKey}
                  date={day}
                  isCurrentMonth={viewMode === "week" ? true : isCurrentMonth}
                  tasks={dayTasks}
                  onTaskClick={onTaskClick}
                  onDateClick={onDateClick}
                  maxTasks={viewMode === "week" ? 10 : 3}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeTask && <TaskPill task={activeTask} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// Mobile/Responsive List View
interface CalendarListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDateClick: (date: Date) => void;
}

export function CalendarListView({
  tasks,
  onTaskClick,
  onDateClick,
}: CalendarListViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get tasks for the current month, grouped by date
  const tasksByDate = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const map: Record<string, Task[]> = {};

    tasks
      .filter((task) => {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        return due >= monthStart && due <= monthEnd;
      })
      .sort((a, b) => {
        const dateA = new Date(a.dueDate!).getTime();
        const dateB = new Date(b.dueDate!).getTime();
        return dateA - dateB;
      })
      .forEach((task) => {
        const dateKey = format(new Date(task.dueDate!), "yyyy-MM-dd");
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(task);
      });

    return map;
  }, [tasks, currentDate]);

  const sortedDates = Object.keys(tasksByDate).sort();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Task List by Date */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {sortedDates.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No tasks with due dates this month
          </div>
        ) : (
          sortedDates.map((dateKey) => {
            const date = new Date(dateKey);
            const dateTasks = tasksByDate[dateKey];

            return (
              <div key={dateKey} className="space-y-2">
                <div
                  onClick={() => onDateClick(date)}
                  className={clsx(
                    "flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer",
                    isToday(date)
                      ? "bg-indigo-500/20 border border-indigo-500/50"
                      : "bg-slate-800/50 hover:bg-slate-800"
                  )}
                >
                  <span
                    className={clsx(
                      "text-lg font-bold",
                      isToday(date) ? "text-indigo-400" : "text-white"
                    )}
                  >
                    {format(date, "d")}
                  </span>
                  <span className="text-slate-400 text-sm">
                    {format(date, "EEEE")}
                  </span>
                  {isToday(date) && (
                    <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full ml-2">
                      Today
                    </span>
                  )}
                </div>

                <div className="pl-4 space-y-2">
                  {dateTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      className={clsx(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer border-l-2 transition-colors",
                        "bg-slate-800/50 hover:bg-slate-700",
                        priorityBorderColors[task.priority as Priority]
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {task.title}
                        </p>
                        {task.assignee && (
                          <p className="text-slate-400 text-sm truncate">
                            {task.assignee.name || task.assignee.email}
                          </p>
                        )}
                      </div>
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded-full text-xs capitalize",
                          priorityColors[task.priority as Priority],
                          "text-white"
                        )}
                      >
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
