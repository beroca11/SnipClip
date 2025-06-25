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
    const parseShortcut = (shortcut: string) => {
      const parts = shortcut.toLowerCase().split('+');
      const modifiers = parts.slice(0, -1);
      const key = parts[parts.length - 1];
      return { modifiers, key };
    };

    const checkShortcut = (e: KeyboardEvent, shortcut: string) => {
      const { modifiers, key } = parseShortcut(shortcut);
      
      const pressedModifiers: string[] = [];
      if (e.ctrlKey || e.metaKey) pressedModifiers.push('ctrl');
      if (e.altKey) pressedModifiers.push('alt');
      if (e.shiftKey) pressedModifiers.push('shift');
      
      const pressedKey = e.key.toLowerCase();
      
      return (
        modifiers.length === pressedModifiers.length &&
        modifiers.every(mod => pressedModifiers.includes(mod)) &&
        key === pressedKey
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!settings) return;

      // Check snippet shortcut
      if (checkShortcut(e, settings.snippetShortcut)) {
        e.preventDefault();
        onSnippetsOpen();
      }
      
      // Check clipboard shortcut
      if (checkShortcut(e, settings.clipboardShortcut)) {
        e.preventDefault();
        onClipboardOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSnippetsOpen, onClipboardOpen, settings]);
}
