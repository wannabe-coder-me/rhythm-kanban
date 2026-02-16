"use client";

import { boardTemplates, BoardTemplate } from "@/lib/board-templates";
import clsx from "clsx";

interface BoardTemplateSelectorProps {
  selectedId: string | null;
  onSelect: (template: BoardTemplate) => void;
}

export function BoardTemplateSelector({ selectedId, onSelect }: BoardTemplateSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {boardTemplates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template)}
          className={clsx(
            "text-left p-4 rounded-lg border-2 transition-all hover:border-indigo-500/70",
            selectedId === template.id
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-slate-600 bg-slate-700/50 hover:bg-slate-700"
          )}
        >
          {/* Template Name & Description */}
          <div className="mb-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              {template.name}
              {selectedId === template.id && (
                <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </h4>
            <p className="text-sm text-slate-400 mt-0.5">{template.description}</p>
          </div>

          {/* Column Preview */}
          <div className="flex gap-1 h-6">
            {template.columns.map((col, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{ backgroundColor: col.color, opacity: 0.8 }}
                title={col.name}
              />
            ))}
          </div>

          {/* Labels Preview (if any) */}
          {template.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {template.labels.slice(0, 4).map((label, i) => (
                <span
                  key={i}
                  className="text-xs px-1.5 py-0.5 rounded text-white/90"
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
              {template.labels.length > 4 && (
                <span className="text-xs text-slate-400">
                  +{template.labels.length - 4} more
                </span>
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
