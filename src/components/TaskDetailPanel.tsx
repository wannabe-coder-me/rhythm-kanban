"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Task, User, Comment, Activity, Column, Priority, Attachment, Label, TaskDependency } from "@/types";
import { format } from "date-fns";
import clsx from "clsx";
import { LabelSelector } from "./LabelSelector";
import { RecurrenceSettings } from "./RecurrenceSettings";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskDetailPanelProps {
  task: Task | null;
  columns: Column[];
  users: User[];
  boardId: string;
  availableLabels: Label[];
  allBoardTasks?: Task[];
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task> & { labelIds?: string[] }) => void;
  onDelete: (taskId: string) => void;
  onLabelsChange: () => void;
}

const priorities: Priority[] = ["low", "medium", "high", "urgent"];

const priorityColors: Record<Priority, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

// Sortable Subtask Item Component
interface SortableSubtaskItemProps {
  subtask: Task;
  isEditing: boolean;
  editingTitle: string;
  onToggleComplete: () => void;
  onStartEdit: () => void;
  onEditChange: (title: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
}

function SortableSubtaskItem({
  subtask,
  isEditing,
  editingTitle,
  onToggleComplete,
  onStartEdit,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
}: SortableSubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg group",
        subtask.completed && "opacity-60",
        isDragging && "shadow-lg"
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 touch-none"
        title="Drag to reorder"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {/* Checkbox */}
      <button
        onClick={onToggleComplete}
        className={clsx(
          "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
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

      {/* Title */}
      {isEditing ? (
        <input
          type="text"
          value={editingTitle}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onEditSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSave();
            if (e.key === "Escape") onEditCancel();
          }}
          autoFocus
          className="flex-1 bg-slate-600 border border-indigo-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
        />
      ) : (
        <span
          onClick={onStartEdit}
          className={clsx(
            "flex-1 text-sm cursor-pointer hover:text-indigo-400",
            subtask.completed ? "text-slate-400 line-through" : "text-white"
          )}
        >
          {subtask.title}
        </span>
      )}

      {/* Assignee */}
      {subtask.assignee && (
        <div
          className="flex-shrink-0"
          title={subtask.assignee.name || subtask.assignee.email}
        >
          {subtask.assignee.image ? (
            <Image
              src={subtask.assignee.image}
              alt={subtask.assignee.name || ""}
              width={20}
              height={20}
              className="rounded-full"
            />
          ) : (
            <div className="w-5 h-5 bg-slate-600 rounded-full flex items-center justify-center text-[10px] text-white">
              {(subtask.assignee.name || subtask.assignee.email)?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
        title="Delete subtask"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function TaskDetailPanel({
  task,
  columns,
  users,
  boardId,
  availableLabels,
  allBoardTasks = [],
  onClose,
  onUpdate,
  onDelete,
  onLabelsChange,
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [taskLabels, setTaskLabels] = useState<Label[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState<"comments" | "activity">("comments");
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [lastRecurrence, setLastRecurrence] = useState<Date | null>(null);
  const [parentRecurringId, setParentRecurringId] = useState<string | null>(null);
  
  // Dependency state
  const [blockedBy, setBlockedBy] = useState<TaskDependency[]>([]);
  const [blocking, setBlocking] = useState<TaskDependency[]>([]);
  const [showDependencySearch, setShowDependencySearch] = useState(false);
  const [dependencySearch, setDependencySearch] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority as Priority);
      setDueDate(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
      setAssigneeId(task.assigneeId || "");
      setColumnId(task.columnId);
      setTaskLabels(task.labels || []);
      setSubtasks([]);
      setAttachments([]);
      setBlockedBy([]);
      setBlocking([]);
      setShowDependencySearch(false);
      setDependencySearch("");
      setIsRecurring(task.isRecurring || false);
      setRecurrenceRule(task.recurrenceRule || null);
      setLastRecurrence(task.lastRecurrence || null);
      setParentRecurringId(task.parentRecurringId || null);
      fetchTaskDetails();
    }
  }, [task]);

  const fetchTaskDetails = async () => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        setActivities(data.activities || []);
        setSubtasks(data.subtasks || []);
        setAttachments(data.attachments || []);
        setBlockedBy(data.blockedBy || []);
        setBlocking(data.blocking || []);
      }
    } catch (error) {
      console.error("Failed to fetch task details:", error);
    }
  };

  const addSubtask = async () => {
    if (!task || !newSubtaskTitle.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtaskTitle }),
      });
      if (res.ok) {
        const subtask = await res.json();
        setSubtasks([...subtasks, subtask]);
        setNewSubtaskTitle("");
      }
    } catch (error) {
      console.error("Failed to add subtask:", error);
    }
  };

  const toggleSubtaskComplete = async (subtask: Task) => {
    try {
      const res = await fetch(`/api/tasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !subtask.completed }),
      });
      if (res.ok) {
        setSubtasks(subtasks.map((s) => 
          s.id === subtask.id ? { ...s, completed: !s.completed } : s
        ));
      }
    } catch (error) {
      console.error("Failed to toggle subtask:", error);
    }
  };

  const updateSubtaskTitle = async (subtaskId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setSubtasks(subtasks.map((s) => 
          s.id === subtaskId ? { ...s, title: newTitle } : s
        ));
        setEditingSubtaskId(null);
      }
    } catch (error) {
      console.error("Failed to update subtask:", error);
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${subtaskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSubtasks(subtasks.filter((s) => s.id !== subtaskId));
      }
    } catch (error) {
      console.error("Failed to delete subtask:", error);
    }
  };

  // Drag and drop sensors for subtasks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSubtaskDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !task) return;

    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);

    const reordered = arrayMove(subtasks, oldIndex, newIndex);
    setSubtasks(reordered);

    // Update positions in backend
    try {
      await fetch(`/api/tasks/${task.id}/subtasks/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtaskIds: reordered.map((s) => s.id) }),
      });
    } catch (error) {
      console.error("Failed to reorder subtasks:", error);
    }
  };

  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  // Dependency functions
  const addDependency = async (blockedById: string) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedById }),
      });
      if (res.ok) {
        const dependency = await res.json();
        setBlockedBy([...blockedBy, dependency]);
        setShowDependencySearch(false);
        setDependencySearch("");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to add dependency");
      }
    } catch (error) {
      console.error("Failed to add dependency:", error);
      alert("Failed to add dependency");
    }
  };

  const removeDependency = async (blockedById: string) => {
    if (!task) return;
    try {
      const res = await fetch(
        `/api/tasks/${task.id}/dependencies?blockedById=${blockedById}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setBlockedBy(blockedBy.filter((d) => d.blockedById !== blockedById));
      } else {
        const error = await res.json();
        alert(error.error || "Failed to remove dependency");
      }
    } catch (error) {
      console.error("Failed to remove dependency:", error);
      alert("Failed to remove dependency");
    }
  };

  // Filter tasks for dependency search (exclude self, already added, and subtasks)
  const filteredDependencyTasks = allBoardTasks.filter((t) => {
    if (!task) return false;
    if (t.id === task.id) return false;
    if (t.parentId) return false; // Exclude subtasks
    if (blockedBy.some((d) => d.blockedById === t.id)) return false;
    if (!dependencySearch) return true;
    return t.title.toLowerCase().includes(dependencySearch.toLowerCase());
  });

  // Check if any blockers are incomplete
  const hasIncompleteBlockers = blockedBy.some(
    (d) => d.blockedBy && !d.blockedBy.completed
  );

  // Attachment functions
  const uploadFile = async (file: File) => {
    if (!task) return;
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("File too large. Maximum size is 10MB.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        const attachment = await res.json();
        setAttachments([attachment, ...attachments]);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to upload file");
      }
    } catch (error) {
      console.error("Failed to upload file:", error);
      alert("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!task) return;
    if (!confirm("Delete this attachment?")) return;
    
    try {
      const res = await fetch(
        `/api/tasks/${task.id}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      );
      
      if (res.ok) {
        setAttachments(attachments.filter((a) => a.id !== attachmentId));
      }
    } catch (error) {
      console.error("Failed to delete attachment:", error);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, [task, attachments]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
    e.target.value = ""; // Reset input
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return "📊";
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽️";
    if (mimeType.includes("document") || mimeType.includes("word") || mimeType === "text/plain" || mimeType === "text/markdown") return "📝";
    return "📎";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSave = () => {
    if (!task) return;
    onUpdate(task.id, {
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeId: assigneeId || null,
      columnId,
      labelIds: taskLabels.map((l) => l.id),
    });
  };

  const handleToggleLabel = (labelId: string) => {
    if (!task) return;
    const hasLabel = taskLabels.some((l) => l.id === labelId);
    let newLabels: Label[];
    
    if (hasLabel) {
      newLabels = taskLabels.filter((l) => l.id !== labelId);
    } else {
      const label = availableLabels.find((l) => l.id === labelId);
      if (label) {
        newLabels = [...taskLabels, label];
      } else {
        return;
      }
    }
    
    setTaskLabels(newLabels);
    onUpdate(task.id, { labelIds: newLabels.map((l) => l.id) });
  };

  const handleCreateLabel = async (name: string, color: string): Promise<Label | null> => {
    try {
      const res = await fetch(`/api/boards/${boardId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      
      if (res.ok) {
        const label = await res.json();
        // Auto-add to current task
        if (task) {
          const newLabels = [...taskLabels, label];
          setTaskLabels(newLabels);
          onUpdate(task.id, { labelIds: newLabels.map((l) => l.id) });
        }
        return label;
      }
      return null;
    } catch (err) {
      console.error("Failed to create label:", err);
      return null;
    }
  };

  const handleRecurrenceChange = (newIsRecurring: boolean, newRule: string | null) => {
    if (!task) return;
    setIsRecurring(newIsRecurring);
    setRecurrenceRule(newRule);
    onUpdate(task.id, {
      isRecurring: newIsRecurring,
      recurrenceRule: newRule,
    } as Partial<Task>);
  };

  const addComment = async () => {
    if (!task || !newComment.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments([comment, ...comments]);
        setNewComment("");
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
    }
  };

  if (!task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-slate-800 z-50 slide-in shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Task Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(task.id)}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded transition-colors"
              title="Delete task"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              data-task-title-input
              className="w-full bg-transparent text-xl font-semibold text-white border-none focus:outline-none focus:ring-0"
              placeholder="Task title"
            />
          </div>

          {/* Status / Column */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
              <select
                value={columnId}
                onChange={(e) => {
                  setColumnId(e.target.value);
                  onUpdate(task.id, { columnId: e.target.value });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  onUpdate(task.id, { assigneeId: e.target.value || null });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priority & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
              <div className="flex gap-1">
                {priorities.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPriority(p);
                      onUpdate(task.id, { priority: p });
                    }}
                    className={clsx(
                      "flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all",
                      priority === p
                        ? `${priorityColors[p]} text-white`
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  onUpdate(task.id, { dueDate: e.target.value ? new Date(e.target.value) : null });
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Recurrence - only show for non-instance tasks */}
          {!parentRecurringId && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Repeat</label>
              <RecurrenceSettings
                isRecurring={isRecurring}
                recurrenceRule={recurrenceRule}
                dueDate={dueDate ? new Date(dueDate) : null}
                lastRecurrence={lastRecurrence}
                onChange={handleRecurrenceChange}
              />
            </div>
          )}
          
          {/* Show recurring parent info for instances */}
          {parentRecurringId && (
            <div className="bg-slate-700/50 rounded-lg p-3 text-sm">
              <span className="text-indigo-400">🔄 Recurring instance</span>
              <p className="text-slate-400 text-xs mt-1">
                This task is part of a recurring series
              </p>
            </div>
          )}

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Labels</label>
            <LabelSelector
              boardId={boardId}
              selectedLabels={taskLabels}
              availableLabels={availableLabels}
              onToggleLabel={handleToggleLabel}
              onCreateLabel={handleCreateLabel}
              onLabelsChange={onLabelsChange}
            />
          </div>

          {/* Custom Fields */}
          <CustomFieldsSection
            boardId={boardId}
            taskId={task.id}
            customFieldValues={customFieldValues}
            onUpdate={handleCustomFieldUpdate}
          />

          {/* Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-400">
                Dependencies
                {hasIncompleteBlockers && (
                  <span className="ml-2 text-amber-400 text-xs">🔒 Blocked</span>
                )}
              </label>
            </div>

            {/* Blocked By List */}
            {blockedBy.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1">Blocked by:</p>
                <div className="space-y-1">
                  {blockedBy.map((dep) => (
                    <div
                      key={dep.id}
                      className={clsx(
                        "flex items-center gap-2 p-2 rounded-lg group",
                        dep.blockedBy?.completed
                          ? "bg-green-900/20 border border-green-800/50"
                          : "bg-amber-900/20 border border-amber-800/50"
                      )}
                    >
                      {dep.blockedBy?.completed ? (
                        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                      <span className={clsx(
                        "flex-1 text-sm truncate",
                        dep.blockedBy?.completed ? "text-slate-400 line-through" : "text-white"
                      )}>
                        {dep.blockedBy?.title || "Unknown task"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {dep.blockedBy?.column?.name}
                      </span>
                      <button
                        onClick={() => removeDependency(dep.blockedById)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                        title="Remove dependency"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blocking List */}
            {blocking.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1">Blocking:</p>
                <div className="space-y-1">
                  {blocking.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg"
                    >
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                      <span className="flex-1 text-sm text-slate-300 truncate">
                        {dep.task?.title || "Unknown task"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {dep.task?.column?.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Dependency */}
            {showDependencySearch ? (
              <div className="relative">
                <input
                  type="text"
                  value={dependencySearch}
                  onChange={(e) => setDependencySearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                {/* Task dropdown */}
                <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10">
                  {filteredDependencyTasks.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">
                      {dependencySearch ? "No matching tasks" : "No tasks available"}
                    </div>
                  ) : (
                    filteredDependencyTasks.slice(0, 10).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addDependency(t.id)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-slate-700 text-left transition-colors"
                      >
                        <span className="flex-1 text-sm text-white truncate">{t.title}</span>
                        <span className="text-xs text-slate-500">{t.column?.name}</span>
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowDependencySearch(false);
                    setDependencySearch("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDependencySearch(true)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add dependency
              </button>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSave}
              rows={4}
              placeholder="Add a description..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Attachments {attachments.length > 0 && `(${attachments.length})`}
            </label>
            
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={clsx(
                "border-2 border-dashed rounded-lg p-4 text-center transition-colors mb-3",
                isDragging
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              {isUploading ? (
                <div className="flex items-center justify-center gap-2 text-slate-400">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Uploading...</span>
                </div>
              ) : (
                <div className="text-slate-400">
                  <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm">Drag & drop files here</p>
                  <p className="text-xs text-slate-500 mt-1">or</p>
                  <label className="inline-block mt-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg cursor-pointer transition-colors">
                    Browse files
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.csv,.ppt,.pptx"
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Max 10MB per file</p>
                </div>
              )}
            </div>

            {/* Attachment List */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 p-2 bg-slate-700/50 rounded-lg group hover:bg-slate-700"
                  >
                    {/* Preview for images */}
                    {attachment.mimeType.startsWith("image/") ? (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded overflow-hidden flex-shrink-0"
                      >
                        <img
                          src={attachment.url}
                          alt={attachment.filename}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-2xl flex-shrink-0">
                        {getFileIcon(attachment.mimeType)}
                      </span>
                    )}

                    <div className="flex-1 min-w-0">
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white hover:text-indigo-400 truncate block"
                        title={attachment.filename}
                      >
                        {attachment.filename}
                      </a>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(attachment.size)} • {format(new Date(attachment.createdAt), "MMM d")}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteAttachment(attachment.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition-all"
                      title="Delete attachment"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-400">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="ml-2 text-xs">
                    ({completedSubtasks}/{subtasks.length} completed)
                  </span>
                )}
              </label>
              {subtasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    {Math.round((completedSubtasks / subtasks.length) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Subtask List - Sortable */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSubtaskDragEnd}
            >
              <SortableContext
                items={subtasks.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 mb-3">
                  {subtasks.map((subtask) => (
                    <SortableSubtaskItem
                      key={subtask.id}
                      subtask={subtask}
                      isEditing={editingSubtaskId === subtask.id}
                      editingTitle={editingSubtaskTitle}
                      onToggleComplete={() => toggleSubtaskComplete(subtask)}
                      onStartEdit={() => {
                        setEditingSubtaskId(subtask.id);
                        setEditingSubtaskTitle(subtask.title);
                      }}
                      onEditChange={(title) => setEditingSubtaskTitle(title)}
                      onEditSave={() => updateSubtaskTitle(subtask.id, editingSubtaskTitle)}
                      onEditCancel={() => setEditingSubtaskId(null)}
                      onDelete={() => deleteSubtask(subtask.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add Subtask Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                placeholder="Add a subtask..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={addSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-700">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("comments")}
                className={clsx(
                  "pb-2 text-sm font-medium transition-colors border-b-2",
                  activeTab === "comments"
                    ? "text-indigo-400 border-indigo-400"
                    : "text-slate-400 border-transparent hover:text-white"
                )}
              >
                Comments ({comments.length})
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={clsx(
                  "pb-2 text-sm font-medium transition-colors border-b-2",
                  activeTab === "activity"
                    ? "text-indigo-400 border-indigo-400"
                    : "text-slate-400 border-transparent hover:text-white"
                )}
              >
                Activity ({activities.length})
              </button>
            </div>
          </div>

          {/* Comments */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                  placeholder="Add a comment..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={addComment}
                  className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  Post
                </button>
              </div>

              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {comment.user?.image ? (
                        <Image
                          src={comment.user.image}
                          alt={comment.user.name || ""}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center text-xs text-white">
                          {(comment.user?.name || comment.user?.email)?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-white">
                        {comment.user?.name || comment.user?.email}
                      </span>
                      <span className="text-xs text-slate-500">
                        {format(new Date(comment.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{comment.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          {activeTab === "activity" && (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div className="w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center text-xs text-slate-400">
                    {(activity.user?.name || activity.user?.email)?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-white">{activity.user?.name || activity.user?.email}</span>
                    <span className="text-slate-400"> {activity.action}</span>
                    {activity.details && (
                      <span className="text-slate-500">
                        {" "}
                        {JSON.stringify(activity.details)}
                      </span>
                    )}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
