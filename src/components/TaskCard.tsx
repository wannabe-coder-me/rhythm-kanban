"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import type { Task, Priority } from "@/types";
import { format } from "date-fns";
import clsx from "clsx";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
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

export function TaskCard({ task, onClick }: TaskCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
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
        isDragging && "opacity-50 shadow-2xl rotate-2"
      )}
    >
      <h4 className="text-sm font-medium text-white mb-2">{task.title}</h4>

      {task.subtasks && task.subtasks.length > 0 && (
        <div className="flex items-center gap-1 mb-2 text-xs text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className={task.subtasks.filter(s => s.completed).length === task.subtasks.length ? "text-green-400" : ""}>
            {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
          </span>
        </div>
      )}

      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label) => (
            <span
              key={label}
              className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full"
            >
              {label}
            </span>
          ))}
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
  );
}
