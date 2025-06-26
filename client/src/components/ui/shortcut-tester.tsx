import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { Play, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutTesterProps {
  shortcut: string;
  onTrigger?: () => void;
  className?: string;
}

export function ShortcutTester({ shortcut, onTrigger, className }: ShortcutTesterProps) {
  const [isListening, setIsListening] = useState(false);
  const [lastPressed, setLastPressed] = useState<string>("");
  const [isMatch, setIsMatch] = useState<boolean | null>(null);

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

  const formatPressedKeys = (e: KeyboardEvent) => {
    const keys: string[] = [];
    
    if (e.ctrlKey || e.metaKey) keys.push('ctrl');
    if (e.altKey) keys.push('alt');
    if (e.shiftKey) keys.push('shift');
    
    if (e.key && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
      keys.push(e.key.toLowerCase());
    }
    
    return keys.join('+');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isListening) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const pressedKeys = formatPressedKeys(e);
    setLastPressed(pressedKeys);
    
    const matches = checkShortcut(e, shortcut);
    setIsMatch(matches);
    
    if (matches && onTrigger) {
      onTrigger();
    }
    
    // Stop listening after a short delay
    setTimeout(() => {
      setIsListening(false);
      setLastPressed("");
      setIsMatch(null);
    }, 1000);
  };

  const handleStartTest = () => {
    setIsListening(true);
    setLastPressed("");
    setIsMatch(null);
  };

  useEffect(() => {
    if (isListening) {
      document.addEventListener('keydown', handleKeyDown, true);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [isListening, shortcut]);

  if (!shortcut) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleStartTest}
        disabled={isListening}
        className={cn(
          "flex items-center gap-2",
          isListening && "bg-primary text-white"
        )}
      >
        {isListening ? (
          <>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Listening...
          </>
        ) : (
          <>
            <Play className="h-3 w-3" />
            Test Shortcut
          </>
        )}
      </Button>
      
      {isListening && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Press:</span>
          <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded font-mono text-xs">
            {shortcut}
          </kbd>
        </div>
      )}
      
      {lastPressed && !isListening && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">You pressed:</span>
          <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded font-mono text-xs">
            {lastPressed}
          </kbd>
          {isMatch !== null && (
            isMatch ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <X className="h-4 w-4 text-red-600" />
            )
          )}
        </div>
      )}
    </div>
  );
} 