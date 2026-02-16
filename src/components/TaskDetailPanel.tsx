"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Task, User, Comment, Activity, Column, Priority, Attachment } from "@/types";
import { format } from "date-fns";
import clsx from "clsx";

interface TaskDetailPanelProps {
  task: Task | null;
  columns: Column[];
  users: User[];
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
}

const priorities: Priority[] = ["low", "medium", "high", "urgent"];

const priorityColors: Record<Priority, string> = {
  low: "bg-green-500",
  medium: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-500",
};

export function TaskDetailPanel({
  task,
  columns,
  users,
  onClose,
  onUpdate,
  onDelete,
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
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

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority as Priority);
      setDueDate(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
      setAssigneeId(task.assigneeId || "");
      setColumnId(task.columnId);
      setLabels(task.labels || []);
      setSubtasks([]);
      setAttachments([]);
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

  const completedSubtasks = subtasks.filter((s) => s.completed).length;

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
      labels,
    });
  };

  const addLabel = () => {
    if (newLabel.trim() && !labels.includes(newLabel.trim())) {
      const updated = [...labels, newLabel.trim()];
      setLabels(updated);
      setNewLabel("");
      if (task) {
        onUpdate(task.id, { labels: updated });
      }
    }
  };

  const removeLabel = (label: string) => {
    const updated = labels.filter((l) => l !== label);
    setLabels(updated);
    if (task) {
      onUpdate(task.id, { labels: updated });
    }
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

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Labels</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/20 text-indigo-300 text-sm rounded-full"
                >
                  {label}
                  <button
                    onClick={() => removeLabel(label)}
                    className="hover:text-white"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLabel()}
                placeholder="Add label..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={addLabel}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
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

            {/* Subtask List */}
            <div className="space-y-2 mb-3">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className={clsx(
                    "flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg group",
                    subtask.completed && "opacity-60"
                  )}
                >
                  <button
                    onClick={() => toggleSubtaskComplete(subtask)}
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

                  {editingSubtaskId === subtask.id ? (
                    <input
                      type="text"
                      value={editingSubtaskTitle}
                      onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                      onBlur={() => updateSubtaskTitle(subtask.id, editingSubtaskTitle)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") updateSubtaskTitle(subtask.id, editingSubtaskTitle);
                        if (e.key === "Escape") setEditingSubtaskId(null);
                      }}
                      autoFocus
                      className="flex-1 bg-slate-600 border border-indigo-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingSubtaskId(subtask.id);
                        setEditingSubtaskTitle(subtask.title);
                      }}
                      className={clsx(
                        "flex-1 text-sm cursor-pointer hover:text-indigo-400",
                        subtask.completed ? "text-slate-400 line-through" : "text-white"
                      )}
                    >
                      {subtask.title}
                    </span>
                  )}

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

                  <button
                    onClick={() => deleteSubtask(subtask.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                    title="Delete subtask"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

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
