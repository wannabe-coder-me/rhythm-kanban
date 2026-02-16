"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomField, CustomFieldValue } from "@/types";
import clsx from "clsx";

interface CustomFieldsSectionProps {
  boardId: string;
  taskId: string;
  customFieldValues: CustomFieldValue[];
  onUpdate: (customFields: Record<string, string | boolean | null>) => void;
}

export function CustomFieldsSection({
  boardId,
  taskId,
  customFieldValues,
  onUpdate,
}: CustomFieldsSectionProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  // Convert customFieldValues array to a map
  useEffect(() => {
    const valueMap: Record<string, string | null> = {};
    customFieldValues.forEach((cfv) => {
      valueMap[cfv.customFieldId] = cfv.value;
    });
    setValues(valueMap);
  }, [customFieldValues]);

  // Fetch custom fields for this board
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

  const handleChange = (fieldId: string, value: string | boolean | null) => {
    // Update local state
    const newValues = {
      ...values,
      [fieldId]: typeof value === "boolean" ? (value ? "true" : "false") : value,
    };
    setValues(newValues);

    // Notify parent to save
    onUpdate({ [fieldId]: value });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-400 mb-3">
        Custom Fields
      </label>
      <div className="space-y-4">
        {fields.map((field) => (
          <CustomFieldInput
            key={field.id}
            field={field}
            value={values[field.id] ?? null}
            onChange={(value) => handleChange(field.id, value)}
          />
        ))}
      </div>
    </div>
  );
}

interface CustomFieldInputProps {
  field: CustomField;
  value: string | null;
  onChange: (value: string | boolean | null) => void;
}

function CustomFieldInput({ field, value, onChange }: CustomFieldInputProps) {
  const [localValue, setLocalValue] = useState(value ?? "");

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const handleBlur = () => {
    if (localValue !== (value ?? "")) {
      onChange(localValue || null);
    }
  };

  const renderInput = () => {
    switch (field.type) {
      case "text":
        return (
          <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            placeholder={`Enter ${field.name.toLowerCase()}...`}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            placeholder="0"
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value);
              onChange(e.target.value || null);
            }}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        );

      case "select": {
        const options: string[] = field.options ? JSON.parse(field.options) : [];
        return (
          <select
            value={localValue}
            onChange={(e) => {
              setLocalValue(e.target.value);
              onChange(e.target.value || null);
            }}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          >
            <option value="">Select...</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      case "checkbox":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localValue === "true"}
              onChange={(e) => {
                const newValue = e.target.checked;
                setLocalValue(newValue ? "true" : "false");
                onChange(newValue);
              }}
              className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500 w-5 h-5"
            />
            <span className="text-sm text-slate-300">
              {localValue === "true" ? "Yes" : "No"}
            </span>
          </label>
        );

      case "url":
        return (
          <div className="relative">
            <input
              type="url"
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleBlur}
              placeholder="https://..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 pr-10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            {localValue && (
              <a
                href={localValue}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-400 transition-colors"
                title="Open link"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <label className="flex items-center gap-1 text-sm text-slate-300 mb-1.5">
        {field.name}
        {field.required && <span className="text-amber-400">*</span>}
      </label>
      {renderInput()}
    </div>
  );
}
