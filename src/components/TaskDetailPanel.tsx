"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { Task, User, Comment, Activity, Column, Priority } from "@/types";
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

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority as Priority);
      setDueDate(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
      setAssigneeId(task.assigneeId || "");
      setColumnId(task.columnId);
      setLabels(task.labels || []);
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
      }
    } catch (error) {
      console.error("Failed to fetch task details:", error);
    }
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
