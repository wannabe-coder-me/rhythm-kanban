"use client";

import { useState, useRef, useEffect } from "react";
import type { Label } from "@/types";
import { LABEL_COLORS, getContrastColor } from "@/lib/label-colors";
import clsx from "clsx";

interface LabelSelectorProps {
  boardId: string;
  selectedLabels: Label[];
  availableLabels: Label[];
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (name: string, color: string) => Promise<Label | null>;
  onLabelsChange?: () => void;
}

export function LabelSelector({
  boardId,
  selectedLabels,
  availableLabels,
  onToggleLabel,
  onCreateLabel,
  onLabelsChange,
}: LabelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [selectedColor, setSelectedColor] = useState(LABEL_COLORS[0].hex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreateLabel = async () => {
    if (!newLabelName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    const label = await onCreateLabel(newLabelName.trim(), selectedColor);
    setIsSubmitting(false);
    
    if (label) {
      setNewLabelName("");
      setSelectedColor(LABEL_COLORS[0].hex);
      setIsCreating(false);
      onLabelsChange?.();
    }
  };

  const selectedIds = new Set(selectedLabels.map((l) => l.id));

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Labels Display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedLabels.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full"
            style={{
              backgroundColor: label.color,
              color: getContrastColor(label.color),
            }}
          >
            {label.name}
            <button
              onClick={() => onToggleLabel(label.id)}
              className="hover:opacity-70"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
        {selectedLabels.length === 0 ? "Add labels" : "Edit labels"}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
          {!isCreating ? (
            <>
              {/* Label List */}
              <div className="max-h-48 overflow-y-auto p-2">
                {availableLabels.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No labels yet</p>
                ) : (
                  availableLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => onToggleLabel(label.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700 transition-colors"
                    >
                      <div
                        className={clsx(
                          "w-4 h-4 rounded border-2 flex items-center justify-center",
                          selectedIds.has(label.id) ? "border-white" : "border-transparent"
                        )}
                        style={{ backgroundColor: label.color }}
                      >
                        {selectedIds.has(label.id) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span
                        className="flex-1 text-sm text-left px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: `${label.color}20`,
                          color: label.color,
                        }}
                      >
                        {label.name}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Create New Label Button */}
              <div className="border-t border-slate-700 p-2">
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-indigo-400 hover:bg-slate-700 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create new label
                </button>
              </div>
            </>
          ) : (
            /* Create Label Form */
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-white">Create label</span>
              </div>

              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateLabel()}
                placeholder="Label name"
                autoFocus
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {/* Color Picker */}
              <div>
                <p className="text-xs text-slate-400 mb-2">Select color</p>
                <div className="flex flex-wrap gap-2">
                  {LABEL_COLORS.map((color) => (
                    <button
                      key={color.hex}
                      onClick={() => setSelectedColor(color.hex)}
                      className={clsx(
                        "w-6 h-6 rounded-full transition-transform",
                        selectedColor === color.hex && "ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110"
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              {newLabelName.trim() && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Preview</p>
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
                onClick={handleCreateLabel}
                disabled={!newLabelName.trim() || isSubmitting}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                {isSubmitting ? "Creating..." : "Create"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
