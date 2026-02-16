"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomField, FieldType } from "@/types";
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
import clsx from "clsx";

interface CustomFieldManagerProps {
  boardId: string;
  onFieldsChange?: () => void;
}

const fieldTypes: { value: FieldType; label: string; icon: string }[] = [
  { value: "text", label: "Text", icon: "📝" },
  { value: "number", label: "Number", icon: "🔢" },
  { value: "date", label: "Date", icon: "📅" },
  { value: "select", label: "Select", icon: "📋" },
  { value: "checkbox", label: "Checkbox", icon: "☑️" },
  { value: "url", label: "URL", icon: "🔗" },
];

interface SortableFieldItemProps {
  field: CustomField;
  onEdit: (field: CustomField) => void;
  onDelete: (fieldId: string) => void;
}

function SortableFieldItem({ field, onEdit, onDelete }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const fieldType = fieldTypes.find((t) => t.value === field.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg group",
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

      {/* Type Icon */}
      <span className="text-lg" title={fieldType?.label}>
        {fieldType?.icon}
      </span>

      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium truncate">{field.name}</span>
          {field.required && (
            <span className="text-xs text-amber-400" title="Required">*</span>
          )}
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>{fieldType?.label}</span>
          {field.type === "select" && field.options && (
            <span className="text-slate-500">
              ({JSON.parse(field.options).length} options)
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={() => onEdit(field)}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-indigo-400 transition-all"
        title="Edit field"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      <button
        onClick={() => onDelete(field.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-400 transition-all"
        title="Delete field"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

export function CustomFieldManager({ boardId, onFieldsChange }: CustomFieldManagerProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "text" as FieldType,
    options: [] as string[],
    required: false,
  });
  const [newOption, setNewOption] = useState("");
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchFields = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/custom-fields`);
      if (res.ok) {
        const data = await res.json();
        setFields(data);
      }
    } catch (err) {
      console.error("Failed to fetch custom fields:", err);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "text",
      options: [],
      required: false,
    });
    setNewOption("");
    setEditingField(null);
    setShowForm(false);
  };

  const handleEdit = (field: CustomField) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      type: field.type,
      options: field.options ? JSON.parse(field.options) : [],
      required: field.required,
    });
    setShowForm(true);
    clearMessages();
  };

  const handleAddOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData({
        ...formData,
        options: [...formData.options, newOption.trim()],
      });
      setNewOption("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        options: formData.type === "select" ? formData.options : undefined,
        required: formData.required,
        ...(editingField && { fieldId: editingField.id }),
      };

      const res = await fetch(`/api/boards/${boardId}/custom-fields`, {
        method: editingField ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess(editingField ? "Field updated!" : "Field created!");
        resetForm();
        fetchFields();
        onFieldsChange?.();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save field");
      }
    } catch (err) {
      setError("Failed to save field");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm("Delete this custom field? All task values for this field will be lost.")) {
      return;
    }

    clearMessages();
    try {
      const res = await fetch(
        `/api/boards/${boardId}/custom-fields?fieldId=${fieldId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setSuccess("Field deleted!");
        fetchFields();
        onFieldsChange?.();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete field");
      }
    } catch (err) {
      setError("Failed to delete field");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);

    const reordered = arrayMove(fields, oldIndex, newIndex);
    setFields(reordered);

    // Update position in backend
    try {
      await fetch(`/api/boards/${boardId}/custom-fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: active.id,
          position: newIndex,
        }),
      });
      onFieldsChange?.();
    } catch (err) {
      console.error("Failed to reorder fields:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">
            Custom Fields ({fields.length})
          </h3>
          <p className="text-sm text-slate-400">
            Add custom fields to track additional information on tasks
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              clearMessages();
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Field
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-sm">
          {success}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-700/50 rounded-lg p-4 space-y-4"
        >
          <h4 className="font-medium text-white">
            {editingField ? "Edit Field" : "New Custom Field"}
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Field Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Story Points"
                required
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Field Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as FieldType })
                }
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {fieldTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Select Options */}
          {formData.type === "select" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Options
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.options.map((option, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-600 rounded text-sm text-white"
                  >
                    {option}
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="text-slate-400 hover:text-red-400"
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
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                  placeholder="Add option..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
                >
                  Add
                </button>
              </div>
              {formData.options.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  Add at least one option for the select field
                </p>
              )}
            </div>
          )}

          {/* Required Checkbox */}
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={formData.required}
              onChange={(e) =>
                setFormData({ ...formData, required: e.target.checked })
              }
              className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
            />
            Required field
          </label>

          {/* Form Actions */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={
                saving ||
                !formData.name.trim() ||
                (formData.type === "select" && formData.options.length === 0)
              }
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              {saving ? "Saving..." : editingField ? "Update Field" : "Create Field"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-400 hover:text-white px-4 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Fields List */}
      {fields.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {fields.map((field) => (
                <SortableFieldItem
                  key={field.id}
                  field={field}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        !showForm && (
          <div className="text-center py-8 text-slate-500">
            <p>No custom fields yet</p>
            <p className="text-sm mt-1">
              Add fields to track story points, sprints, or any custom data
            </p>
          </div>
        )
      )}

      {/* Field Type Preview */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <h4 className="text-sm font-medium text-slate-400 mb-3">Field Type Reference</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {fieldTypes.map((type) => (
            <div
              key={type.value}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700/30 rounded"
            >
              <span>{type.icon}</span>
              <span className="text-slate-300">{type.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
