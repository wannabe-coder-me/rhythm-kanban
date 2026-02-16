"use client";

import { useState, useEffect } from "react";
import type { Label } from "@/types";
import { LABEL_COLORS, getContrastColor } from "@/lib/label-colors";
import clsx from "clsx";

interface LabelManagerProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  onLabelsChange: () => void;
}

export function LabelManager({ boardId, isOpen, onClose, onLabelsChange }: LabelManagerProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [selectedColor, setSelectedColor] = useState(LABEL_COLORS[0].hex);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchLabels();
    }
  }, [isOpen, boardId]);

  const fetchLabels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/labels`);
      if (res.ok) {
        const data = await res.json();
        setLabels(data);
      }
    } catch (err) {
      console.error("Failed to fetch labels:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const createLabel = async () => {
    if (!newLabelName.trim()) return;
    setError("");

    try {
      const res = await fetch(`/api/boards/${boardId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLabelName.trim(), color: selectedColor }),
      });

      if (res.ok) {
        const label = await res.json();
        setLabels([...labels, label]);
        setNewLabelName("");
        setSelectedColor(LABEL_COLORS[0].hex);
        onLabelsChange();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create label");
      }
    } catch (err) {
      console.error("Failed to create label:", err);
      setError("Failed to create label");
    }
  };

  const updateLabel = async (labelId: string) => {
    if (!editingName.trim()) return;
    setError("");

    try {
      const res = await fetch(`/api/boards/${boardId}/labels`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId, name: editingName.trim(), color: editingColor }),
      });

      if (res.ok) {
        const updated = await res.json();
        setLabels(labels.map((l) => (l.id === labelId ? updated : l)));
        setEditingId(null);
        onLabelsChange();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update label");
      }
    } catch (err) {
      console.error("Failed to update label:", err);
      setError("Failed to update label");
    }
  };

  const deleteLabel = async (labelId: string) => {
    if (!confirm("Delete this label? It will be removed from all tasks.")) return;

    try {
      const res = await fetch(`/api/boards/${boardId}/labels?labelId=${labelId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setLabels(labels.filter((l) => l.id !== labelId));
        onLabelsChange();
      }
    } catch (err) {
      console.error("Failed to delete label:", err);
    }
  };

  const startEditing = (label: Label) => {
    setEditingId(label.id);
    setEditingName(label.name);
    setEditingColor(label.color);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Manage Labels</h2>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Create New Label */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Create new label</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createLabel()}
                  placeholder="Label name"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="flex flex-wrap gap-2">
                  {LABEL_COLORS.map((color) => (
                    <button
                      key={color.hex}
                      onClick={() => setSelectedColor(color.hex)}
                      className={clsx(
                        "w-7 h-7 rounded-full transition-all",
                        selectedColor === color.hex && "ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110"
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>

                {newLabelName.trim() && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Preview:</span>
                    <span
                      className="inline-block px-2 py-0.5 text-sm rounded-full"
                      style={{
                        backgroundColor: selectedColor,
                        color: getContrastColor(selectedColor),
                      }}
                    >
                      {newLabelName.trim()}
                    </span>
                  </div>
                )}

                <button
                  onClick={createLabel}
                  disabled={!newLabelName.trim()}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Create Label
                </button>
              </div>
            </div>

            {/* Existing Labels */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3">
                Board labels ({labels.length})
              </h3>

              {isLoading ? (
                <div className="text-center py-4 text-slate-500">Loading...</div>
              ) : labels.length === 0 ? (
                <div className="text-center py-4 text-slate-500">No labels yet</div>
              ) : (
                <div className="space-y-2">
                  {labels.map((label) => (
                    <div
                      key={label.id}
                      className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg group"
                    >
                      {editingId === label.id ? (
                        <>
                          <div className="flex flex-wrap gap-1.5 mb-2 w-full">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") updateLabel(label.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                              className="flex-1 bg-slate-600 border border-indigo-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5 w-full">
                            {LABEL_COLORS.map((color) => (
                              <button
                                key={color.hex}
                                onClick={() => setEditingColor(color.hex)}
                                className={clsx(
                                  "w-5 h-5 rounded-full transition-all",
                                  editingColor === color.hex && "ring-2 ring-white ring-offset-1 ring-offset-slate-700"
                                )}
                                style={{ backgroundColor: color.hex }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-1.5 w-full mt-2">
                            <button
                              onClick={() => updateLabel(label.id)}
                              className="flex-1 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex-1 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: label.color }}
                          />
                          <span
                            className="flex-1 text-sm px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${label.color}20`,
                              color: label.color,
                            }}
                          >
                            {label.name}
                          </span>
                          <button
                            onClick={() => startEditing(label)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-all"
                            title="Edit label"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteLabel(label.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 transition-all"
                            title="Delete label"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
