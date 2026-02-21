"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState, useEffect } from "react";
import type { Column as ColumnType, Task, TaskTemplate } from "@/types";
import { TaskCard } from "./TaskCard";
import clsx from "clsx";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  boardId?: string;
  onTaskClick: (task: Task) => void;
  onAddTask: (columnId: string, title: string) => void;
  onTaskCreatedFromTemplate?: (task: Task) => void;
  onDeleteColumn?: () => void;
  onToggleSubtask?: (subtaskId: string, completed: boolean) => void;
  selectedTaskId?: string | null;
  scheduledTaskIds?: Set<string>;
}

export function Column({
  column,
  tasks,
  boardId,
  onTaskClick,
  onAddTask,
  onTaskCreatedFromTemplate,
  onDeleteColumn,
  onToggleSubtask,
  selectedTaskId,
  scheduledTaskIds = new Set(),
}: ColumnProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Fetch templates when dropdown is shown
  useEffect(() => {
    if (showTemplateDropdown && boardId) {
      setLoadingTemplates(true);
      fetch(`/api/boards/${boardId}/task-templates`)
        .then((res) => res.json())
        .then((data) => setTemplates(data))
        .catch((err) => console.error("Failed to fetch templates:", err))
        .finally(() => setLoadingTemplates(false));
    }
  }, [showTemplateDropdown, boardId]);

  const handleUseTemplate = async (template: TaskTemplate) => {
    if (!boardId) return;
    try {
      const res = await fetch(
        `/api/boards/${boardId}/task-templates/${template.id}/use`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId: column.id }),
        }
      );
      if (res.ok) {
        const task = await res.json();
        onTaskCreatedFromTemplate?.(task);
        setShowTemplateDropdown(false);
      }
    } catch (err) {
      console.error("Failed to create task from template:", err);
    }
  };

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

  const handleAddTask = (keepOpen = false) => {
    if (newTaskTitle.trim()) {
      onAddTask(column.id, newTaskTitle);
      setNewTaskTitle("");
      if (!keepOpen) {
        setIsAdding(false);
      }
    }
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={clsx(
        "w-72 min-w-[200px] shrink bg-slate-800/50 rounded-lg flex flex-col max-h-full",
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

      {/* Tasks - droppable area (click empty space to add task) */}
      <div
        ref={setDroppableRef}
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px] cursor-pointer"
        onClick={(e) => {
          // Only trigger if clicking the container itself, not a card
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-task-id]') === null) {
            setIsAdding(true);
          }
        }}
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
              isScheduled={scheduledTaskIds.has(task.id)}
            />
          ))}
        </SortableContext>
        
        {/* Visual hint for empty space */}
        {tasks.length > 0 && !isAdding && (
          <div className="h-8 flex items-center justify-center text-slate-600 text-xs opacity-0 hover:opacity-100 transition-opacity">
            Click to add task
          </div>
        )}
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
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTask(true); // Keep input open for rapid entry
                }
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
                onClick={() => handleAddTask()}
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
          <div className="relative">
            <div className="flex gap-1">
              <button
                onClick={() => setIsAdding(true)}
                data-add-task
                data-column-id={column.id}
                className="flex-1 flex items-center gap-2 text-slate-400 hover:text-white text-sm py-2 px-3 hover:bg-slate-700 rounded-l transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add task
              </button>
              {boardId && (
                <button
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  className="px-2 text-slate-400 hover:text-white text-sm py-2 hover:bg-slate-700 rounded-r transition-colors border-l border-slate-600"
                  title="Create from template"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>
            {/* Template Dropdown */}
            {showTemplateDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowTemplateDropdown(false)}
                />
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-slate-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden max-h-64 overflow-y-auto">
                  {loadingTemplates ? (
                    <div className="px-4 py-2 text-sm text-slate-400">Loading...</div>
                  ) : templates.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">
                      No templates yet
                    </div>
                  ) : (
                    templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleUseTemplate(template)}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate">{template.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
