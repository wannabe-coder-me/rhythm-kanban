"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskTemplate, Label, Priority } from "@/types";

interface TemplateManagerProps {
  boardId: string;
  labels: Label[];
  isOpen: boolean;
  onClose: () => void;
  onTemplateSelect?: (template: TaskTemplate) => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "bg-slate-500" },
  { value: "medium", label: "Medium", color: "bg-blue-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
];

export function TemplateManager({
  boardId,
  labels,
  isOpen,
  onClose,
  onTemplateSelect,
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/task-templates`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  const resetForm = () => {
    setName("");
    setTitle("");
    setDescription("");
    setPriority("medium");
    setSelectedLabels([]);
    setSubtasks([]);
    setNewSubtask("");
    setEditingTemplate(null);
    setError(null);
  };

  const handleEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setTitle(template.title);
    setDescription(template.description || "");
    setPriority(template.priority);
    setSelectedLabels(template.labels);
    setSubtasks(template.subtasks);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !title.trim()) {
      setError("Template name and default title are required");
      return;
    }

    const data = {
      name: name.trim(),
      title: title.trim(),
      description: description.trim() || null,
      priority,
      labels: selectedLabels,
      subtasks,
    };

    try {
      const url = editingTemplate
        ? `/api/boards/${boardId}/task-templates/${editingTemplate.id}`
        : `/api/boards/${boardId}/task-templates`;
      const method = editingTemplate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const template = await res.json();
        if (editingTemplate) {
          setTemplates(templates.map((t) => (t.id === template.id ? template : t)));
        } else {
          setTemplates([...templates, template]);
        }
        setShowForm(false);
        resetForm();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to save template");
      }
    } catch (err) {
      setError("Failed to save template");
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;

    try {
      const res = await fetch(
        `/api/boards/${boardId}/task-templates/${templateId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== templateId));
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, newSubtask.trim()]);
      setNewSubtask("");
    }
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">
            {showForm
              ? editingTemplate
                ? "Edit Template"
                : "Create Template"
              : "Task Templates"}
          </h2>
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                resetForm();
              } else {
                onClose();
              }
            }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bug Report, Feature Request"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Default Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Bug: , Feature: {date}"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Variables: {"{date}"}, {"{user}"}, {"{week}"}, {"{month}"}, {"{year}"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Default description for tasks created from this template..."
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Priority
                </label>
                <div className="flex gap-2">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        priority === opt.value
                          ? `${opt.color} text-white`
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {labels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Labels
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleLabel(label.id)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                          selectedLabels.includes(label.id)
                            ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800"
                            : "opacity-60 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: label.color, color: "#fff" }}
                      >
                        {label.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Subtasks
                </label>
                <div className="space-y-2">
                  {subtasks.map((subtask, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-slate-700 px-3 py-2 rounded-lg"
                    >
                      <span className="flex-1 text-slate-200">{subtask}</span>
                      <button
                        type="button"
                        onClick={() => removeSubtask(index)}
                        className="text-slate-400 hover:text-red-400"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSubtask();
                        }
                      }}
                      placeholder="Add a subtask..."
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={addSubtask}
                      className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-500 transition-colors font-medium"
                >
                  {editingTemplate ? "Update Template" : "Create Template"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              {loading ? (
                <div className="text-center py-8 text-slate-400">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="w-16 h-16 mx-auto text-slate-600 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No templates yet</h3>
                  <p className="text-slate-500 mb-6">
                    Create templates to quickly add common task types
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                  >
                    Create Your First Template
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-slate-700/50 rounded-lg p-4 hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{template.name}</h3>
                          <p className="text-sm text-slate-400 mt-1">
                            Title: <span className="text-slate-300">{template.title}</span>
                          </p>
                          {template.description && (
                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                template.priority === "urgent"
                                  ? "bg-red-500/20 text-red-400"
                                  : template.priority === "high"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : template.priority === "medium"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-slate-500/20 text-slate-400"
                              }`}
                            >
                              {template.priority}
                            </span>
                            {template.subtasks.length > 0 && (
                              <span className="text-xs text-slate-500">
                                {template.subtasks.length} subtask(s)
                              </span>
                            )}
                            {template.labels.length > 0 && (
                              <span className="text-xs text-slate-500">
                                {template.labels.length} label(s)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {onTemplateSelect && (
                            <button
                              onClick={() => onTemplateSelect(template)}
                              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500 transition-colors"
                            >
                              Use
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(template)}
                            className="p-1.5 text-slate-400 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!showForm && templates.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-700">
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Export a simpler dropdown component for quick template selection
interface TemplateDropdownProps {
  boardId: string;
  columnId: string;
  onTaskCreated: (task: unknown) => void;
  onClose: () => void;
}

export function TemplateDropdown({
  boardId,
  columnId,
  onTaskCreated,
  onClose,
}: TemplateDropdownProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch(`/api/boards/${boardId}/task-templates`);
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
        }
      } catch (err) {
        console.error("Failed to fetch templates:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [boardId]);

  const handleUseTemplate = async (template: TaskTemplate) => {
    try {
      const res = await fetch(
        `/api/boards/${boardId}/task-templates/${template.id}/use`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnId }),
        }
      );
      if (res.ok) {
        const task = await res.json();
        onTaskCreated(task);
        onClose();
      }
    } catch (err) {
      console.error("Failed to create task from template:", err);
    }
  };

  return (
    <div className="absolute left-0 mt-1 w-56 bg-slate-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
      {loading ? (
        <div className="px-4 py-2 text-sm text-slate-400">Loading...</div>
      ) : (
        <>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Blank Task
          </button>
          {templates.length > 0 && (
            <>
              <div className="h-px bg-slate-600 my-1" />
              <div className="px-2 py-1 text-xs text-slate-500 uppercase tracking-wider">
                Templates
              </div>
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleUseTemplate(template)}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {template.name}
                </button>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
