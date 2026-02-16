"use client";

import { useEffect, useCallback, useRef } from "react";

export interface ShortcutHandler {
  key: string;
  description: string;
  handler: () => void;
  category: "global" | "board" | "navigation" | "task";
  /** If true, requires exact key match (no modifiers) */
  exact?: boolean;
  /** If true, works even when an input is focused */
  global?: boolean;
}

export interface KeyboardShortcutsConfig {
  shortcuts: ShortcutHandler[];
  enabled?: boolean;
}

/**
 * Check if the current focus is on an input element
 */
function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  
  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  
  // Check for contenteditable
  if (activeElement.hasAttribute("contenteditable")) {
    return true;
  }
  
  return false;
}

/**
 * Parse a key combination like "g h" or "Escape" or "Delete"
 */
function parseKeyCombo(combo: string): string[] {
  return combo.split(" ").map((k) => k.toLowerCase());
}

/**
 * Hook for handling keyboard shortcuts with support for key sequences (e.g., "g h")
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const { shortcuts, enabled = true } = config;
  const sequenceRef = useRef<string[]>([]);
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Get the key, normalized
      const key = event.key.toLowerCase();
      
      // Skip if it's a modifier key by itself
      if (["control", "alt", "meta", "shift"].includes(key)) {
        return;
      }

      // Check if input is focused - most shortcuts should be disabled
      const inputFocused = isInputFocused();

      // Handle Escape specially - it should always work to close things
      if (key === "escape") {
        const escapeShortcuts = shortcuts.filter(
          (s) => parseKeyCombo(s.key)[0] === "escape"
        );
        for (const shortcut of escapeShortcuts) {
          shortcut.handler();
        }
        sequenceRef.current = [];
        return;
      }

      // For other keys, skip if input is focused (unless shortcut is marked global)
      if (inputFocused) {
        return;
      }

      // Clear sequence timeout
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }

      // Add key to sequence
      sequenceRef.current.push(key);

      // Set timeout to clear sequence after 1 second
      sequenceTimeoutRef.current = setTimeout(() => {
        sequenceRef.current = [];
      }, 1000);

      // Check for matches
      for (const shortcut of shortcuts) {
        const combo = parseKeyCombo(shortcut.key);
        const sequence = sequenceRef.current;

        // Check if sequence matches
        if (sequence.length >= combo.length) {
          const recentSequence = sequence.slice(-combo.length);
          if (combo.every((k, i) => k === recentSequence[i])) {
            // Match found!
            event.preventDefault();
            shortcut.handler();
            sequenceRef.current = [];
            return;
          }
        }
      }

      // If sequence is too long without a match, keep only the last key
      if (sequenceRef.current.length > 3) {
        sequenceRef.current = [key];
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Get all shortcuts organized by category
 */
export function getShortcutsByCategory(shortcuts: ShortcutHandler[]) {
  const categories: Record<string, ShortcutHandler[]> = {
    global: [],
    board: [],
    navigation: [],
    task: [],
  };

  for (const shortcut of shortcuts) {
    categories[shortcut.category]?.push(shortcut);
  }

  return categories;
}

/**
 * Format a key for display (e.g., "g h" -> "G then H")
 */
export function formatKeyForDisplay(key: string): string {
  const parts = key.split(" ");
  if (parts.length === 1) {
    return formatSingleKey(parts[0]);
  }
  return parts.map(formatSingleKey).join(" → ");
}

function formatSingleKey(key: string): string {
  const keyMap: Record<string, string> = {
    escape: "Esc",
    enter: "Enter",
    delete: "Del",
    backspace: "⌫",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    "?": "?",
  };
  
  return keyMap[key.toLowerCase()] || key.toUpperCase();
}
