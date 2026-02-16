"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import type { Task, Priority } from "@/types";
import { format } from "date-fns";
import clsx from "clsx";
import { useState } from "react";
import { getContrastColor } from "@/lib/label-colors";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onToggleSubtask?: (subtaskId: string, completed: boolean) => void;
  isSelected?: boolean;
}

const priorityColors: Record<Priority, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

const priorityBorders: Record<Priority, string> = {
  low: "border-l-green-500",
  medium: "border-l-blue-500",
  high: "border-l-amber-500",
  urgent: "border-l-red-500",
};

export function TaskCard({ task, onClick, onToggleSubtask, isSelected = false }: TaskCardProps) {
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.column?.name !== "Done";

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;
  const allSubtasksComplete = completedSubtasks === totalSubtasks && totalSubtasks > 0;

  // Check if task is blocked by incomplete dependencies
  const blockedByCount = task.blockedBy?.filter(
    (d) => d.blockedBy && !d.blockedBy.completed
  ).length || 0;
  const isBlocked = blockedByCount > 0;

  const handleToggleSubtask = (e: React.MouseEvent, subtaskId: string, currentState: boolean) => {
    e.stopPropagation();
    onToggleSubtask?.(subtaskId, !currentState);
  };

  const toggleSubtasksExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSubtasksExpanded(!subtasksExpanded);
  };

  return (
    <div ref={setNodeRef} style={style} data-task-id={task.id}>
      {/* Main Task Card */}
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={clsx(
          "bg-slate-700 hover:bg-slate-650 border border-slate-600 rounded-lg p-3 cursor-pointer transition-all",
          "border-l-4",
          priorityBorders[task.priority as Priority],
          isDragging && "opacity-50 shadow-2xl rotate-2",
          isSelected && "ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-800",
          isBlocked && "opacity-70 bg-slate-700/80"
        )}
      >
        {/* Blocked indicator */}
        {isBlocked && (
          <div className="flex items-center gap-1.5 text-amber-400 text-xs mb-2" title={`Blocked by ${blockedByCount} task${blockedByCount > 1 ? 's' : ''}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Blocked by {blockedByCount} task{blockedByCount > 1 ? 's' : ''}</span>
          </div>
        )}
        <h4 className="text-sm font-medium text-white mb-2">{task.title}</h4>

        {/* Subtasks Summary with expand toggle */}
        {hasSubtasks && (
          <div className="mb-2">
            <button
              onClick={toggleSubtasksExpanded}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors w-full group"
            >
              <svg 
                className={clsx(
                  "w-3 h-3 transition-transform",
                  subtasksExpanded && "rotate-90"
                )} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className={allSubtasksComplete ? "text-green-400" : ""}>
                {completedSubtasks}/{totalSubtasks} subtasks
              </span>
              {/* Progress bar */}
              <div className="flex-1 h-1 bg-slate-600 rounded-full overflow-hidden ml-2">
                <div 
                  className={clsx(
                    "h-full rounded-full transition-all",
                    allSubtasksComplete ? "bg-green-500" : "bg-indigo-500"
                  )}
                  style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                />
              </div>
            </button>
          </div>
        )}

        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.labels.length <= 3 ? (
              // Show full pills for up to 3 labels
              task.labels.map((label) => (
                <span
                  key={label.id}
                  className="px-2 py-0.5 text-xs rounded-full"
                  style={{
                    backgroundColor: label.color,
                    color: getContrastColor(label.color),
                  }}
                >
                  {label.name}
                </span>
              ))
            ) : (
              // Show colored dots for many labels
              <>
                {task.labels.slice(0, 4).map((label) => (
                  <div
                    key={label.id}
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: label.color }}
                    title={label.name}
                  />
                ))}
                {task.labels.length > 4 && (
                  <span className="text-xs text-slate-400">
                    +{task.labels.length - 4}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            {task.dueDate && (
              <span
                className={clsx(
                  "flex items-center gap-1",
                  isOverdue && "text-red-400"
                )}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {format(new Date(task.dueDate), "MMM d")}
              </span>
            )}
            {task._count?.attachments && task._count.attachments > 0 && (
              <span
                className="flex items-center gap-1"
                title={`${task._count.attachments} attachment${task._count.attachments !== 1 ? 's' : ''}`}
              >
                📎 {task._count.attachments}
              </span>
            )}
            {(task.isRecurring || task.parentRecurringId) && (
              <span
                className="flex items-center"
                title={task.isRecurring ? "Recurring task" : "Instance of recurring task"}
              >
                🔄
              </span>
            )}
            <span
              className={clsx(
                "w-2 h-2 rounded-full",
                priorityColors[task.priority as Priority]
              )}
              title={task.priority}
            />
          </div>

          {task.assignee && (
            <div className="flex items-center gap-1" title={task.assignee.name || task.assignee.email}>
              {task.assignee.image ? (
                <Image
                  src={task.assignee.image}
                  alt={task.assignee.name || ""}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              ) : (
                <div className="w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center text-[10px] text-white">
                  {(task.assignee.name || task.assignee.email)?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Subtasks - Asana-style nested view */}
      {hasSubtasks && subtasksExpanded && (
        <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-600 pl-3">
          {task.subtasks?.map((subtask) => (
            <div
              key={subtask.id}
              className={clsx(
                "flex items-center gap-2 p-2 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer group",
                subtask.completed && "opacity-60"
              )}
              onClick={(e) => {
                e.stopPropagation();
                // Could open subtask details if needed
              }}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => handleToggleSubtask(e, subtask.id, subtask.completed)}
                className={clsx(
                  "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                  subtask.completed 
                    ? "bg-green-500 border-green-500 text-white" 
                    : "border-slate-500 hover:border-slate-400"
                )}
              >
                {subtask.completed && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              
              {/* Subtask title */}
              <span 
                className={clsx(
                  "text-xs flex-1 truncate",
                  subtask.completed ? "text-slate-500 line-through" : "text-slate-300"
                )}
              >
                {subtask.title}
              </span>

              {/* Assignee avatar */}
              {subtask.assignee && (
                <div 
                  className="flex-shrink-0"
                  title={subtask.assignee.name || subtask.assignee.email}
                >
                  {subtask.assignee.image ? (
                    <Image
                      src={subtask.assignee.image}
                      alt={subtask.assignee.name || ""}
                      width={16}
                      height={16}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-4 h-4 bg-slate-600 rounded-full flex items-center justify-center text-[8px] text-white">
                      {(subtask.assignee.name || subtask.assignee.email)?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
