"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import type { ShortcutHandler } from "@/hooks/useKeyboardShortcuts";
import { formatKeyForDisplay } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutHandler[];
}

const categoryLabels: Record<string, string> = {
  global: "Global",
  board: "Board View",
  navigation: "Task Navigation",
  task: "Task Actions",
};

const categoryOrder = ["global", "board", "navigation", "task"];

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
  shortcuts,
}: KeyboardShortcutsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Small delay to prevent immediate close on open
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Group shortcuts by category
  const shortcutsByCategory: Record<string, ShortcutHandler[]> = {};
  for (const shortcut of shortcuts) {
    if (!shortcutsByCategory[shortcut.category]) {
      shortcutsByCategory[shortcut.category] = [];
    }
    shortcutsByCategory[shortcut.category].push(shortcut);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        className={clsx(
          "relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700",
          "w-full max-w-2xl max-h-[80vh] overflow-hidden",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
        style={{
          animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
              <p className="text-sm text-slate-400">Navigate faster with your keyboard</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 max-h-[calc(80vh-120px)]">
          <div className="grid gap-6 md:grid-cols-2">
            {categoryOrder.map((category) => {
              const categoryShortcuts = shortcutsByCategory[category];
              if (!categoryShortcuts || categoryShortcuts.length === 0) return null;

              return (
                <div key={category}>
                  <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    {categoryLabels[category]}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut) => (
                      <div
                        key={shortcut.key}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-sm text-slate-400">{shortcut.description}</span>
                        <ShortcutKey keyCombo={shortcut.key} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-500 text-center">
            Press <ShortcutKey keyCombo="?" size="sm" /> anywhere to toggle this help
          </p>
        </div>
      </div>
    </div>
  );
}

interface ShortcutKeyProps {
  keyCombo: string;
  size?: "sm" | "md";
}

function ShortcutKey({ keyCombo, size = "md" }: ShortcutKeyProps) {
  const parts = keyCombo.split(" ");
  const sizeClasses = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <div className="flex items-center gap-1">
      {parts.map((key, index) => (
        <span key={index} className="flex items-center gap-1">
          <kbd
            className={clsx(
              "font-mono rounded border border-slate-600 bg-slate-700 text-slate-300",
              sizeClasses
            )}
          >
            {formatKeyForDisplay(key)}
          </kbd>
          {index < parts.length - 1 && (
            <span className="text-slate-500 text-xs">then</span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Small button to show in footer that opens the shortcuts modal
 */
export function KeyboardShortcutsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
      title="Keyboard shortcuts (?)"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <span className="hidden sm:inline">Shortcuts</span>
      <kbd className="hidden sm:inline font-mono text-xs px-1.5 py-0.5 bg-slate-700 rounded border border-slate-600">
        ?
      </kbd>
    </button>
  );
}
