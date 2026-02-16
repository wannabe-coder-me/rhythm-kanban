"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import type { Column as ColumnType, Task } from "@/types";
import { TaskCard } from "./TaskCard";
import clsx from "clsx";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (columnId: string, title: string) => void;
  onDeleteColumn?: () => void;
  onToggleSubtask?: (subtaskId: string, completed: boolean) => void;
  selectedTaskId?: string | null;
}

export function Column({
  column,
  tasks,
  onTaskClick,
  onAddTask,
  onDeleteColumn,
  onToggleSubtask,
  selectedTaskId,
}: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  // Make column sortable for reordering
  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({ id: column.id });

  // Make column a drop target for tasks
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      onAddTask(column.id, newTaskTitle);
      setNewTaskTitle("");
      setIsAdding(false);
    }
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={clsx(
        "flex-shrink-0 w-72 bg-slate-800/50 rounded-lg flex flex-col max-h-full",
        isOver && "ring-2 ring-indigo-500",
        isColumnDragging && "opacity-50"
      )}
    >
      {/* Column Header - draggable for reordering */}
      <div
        {...sortableAttributes}
        {...sortableListeners}
        className="p-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: column.color }}
          />
          <h3 className="font-medium text-slate-200">{column.name}</h3>
          <span className="text-sm text-slate-500 bg-slate-700 px-1.5 rounded">
            {tasks.length}
          </span>
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-32 bg-slate-700 rounded-lg shadow-xl z-20 py-1">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDeleteColumn?.();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-600"
                >
                  Delete column
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tasks - droppable area */}
      <div
        ref={setDroppableRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onToggleSubtask={onToggleSubtask}
              isSelected={selectedTaskId === task.id}
            />
          ))}
        </SortableContext>
      </div>

      {/* Add Task */}
      <div className="p-2 border-t border-slate-700">
        {isAdding ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTask();
                if (e.key === "Escape") {
                  setIsAdding(false);
                  setNewTaskTitle("");
                }
              }}
              placeholder="Task title..."
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-1.5 rounded transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewTaskTitle("");
                }}
                className="px-3 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center gap-2 text-slate-400 hover:text-white text-sm py-2 px-3 hover:bg-slate-700 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add task
          </button>
        )}
      </div>
    </div>
  );
}
