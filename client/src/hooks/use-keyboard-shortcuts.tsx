import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";

interface KeyboardShortcutsProps {
  onSnippetsOpen: () => void;
  onClipboardOpen: () => void;
}

export function useKeyboardShortcuts({ onSnippetsOpen, onClipboardOpen }: KeyboardShortcutsProps) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Parse shortcut format like "ctrl+;" or "ctrl+shift+v"
      const parseShortcut = (shortcut: string) => {
        const parts = shortcut.toLowerCase().split('+');
        return {
          ctrl: parts.includes('ctrl'),
          shift: parts.includes('shift'),
          alt: parts.includes('alt'),
          key: parts[parts.length - 1],
        };
      };

      const snippetShortcut = parseShortcut(settings?.snippetShortcut || "ctrl+;");
      const clipboardShortcut = parseShortcut(settings?.clipboardShortcut || "ctrl+shift+v");

      // Check if current key combination matches snippet shortcut
      if (
        e.ctrlKey === snippetShortcut.ctrl &&
        e.shiftKey === snippetShortcut.shift &&
        e.altKey === snippetShortcut.alt &&
        e.key.toLowerCase() === snippetShortcut.key
      ) {
        e.preventDefault();
        onSnippetsOpen();
        return;
      }

      // Check if current key combination matches clipboard shortcut
      if (
        e.ctrlKey === clipboardShortcut.ctrl &&
        e.shiftKey === clipboardShortcut.shift &&
        e.altKey === clipboardShortcut.alt &&
        e.key.toLowerCase() === clipboardShortcut.key
      ) {
        e.preventDefault();
        onClipboardOpen();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [settings, onSnippetsOpen, onClipboardOpen]);
}
