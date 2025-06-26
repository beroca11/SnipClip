import React, { useState, useEffect, useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Keyboard, X, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertSettings } from "@shared/schema";

interface ShortcutInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showSaveButton?: boolean;
  onSave?: (value: string) => void;
}

export function ShortcutInput({ 
  value, 
  onChange, 
  placeholder = "Press keys...", 
  className,
  disabled = false,
  showSaveButton = false,
  onSave
}: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<InsertSettings>) => {
      return await apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Shortcut Updated",
        description: "Your shortcut has been saved successfully",
      });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save shortcut",
        variant: "destructive",
      });
    },
  });

  const formatShortcut = (keys: string[]) => {
    if (keys.length === 0) return "";
    
    // Sort modifiers in a consistent order
    const modifiers = keys.filter(key => ['ctrl', 'alt', 'shift', 'meta', 'cmd'].includes(key.toLowerCase()));
    const regularKeys = keys.filter(key => !['ctrl', 'alt', 'shift', 'meta', 'cmd'].includes(key.toLowerCase()));
    
    const sortedModifiers = modifiers.sort((a, b) => {
      const order = ['ctrl', 'alt', 'shift', 'meta', 'cmd'];
      return order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase());
    });
    
    return [...sortedModifiers, ...regularKeys].join('+').toLowerCase();
  };

  const parseKeyEvent = (e: KeyboardEvent) => {
    const keys: string[] = [];
    
    // Add modifiers
    if (e.ctrlKey) keys.push('ctrl');
    if (e.altKey) keys.push('alt');
    if (e.shiftKey) keys.push('shift');
    if (e.metaKey) keys.push('meta');
    
    // Add the main key
    if (e.key && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
      keys.push(e.key.toLowerCase());
    }
    
    return keys;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isRecording) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const keys = parseKeyEvent(e);
    if (keys.length > 0) {
      setCurrentKeys(keys);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!isRecording) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const keys = parseKeyEvent(e);
    if (keys.length > 0) {
      const shortcut = formatShortcut(keys);
      if (shortcut) {
        onChange(shortcut);
        setHasChanges(true);
        setIsRecording(false);
        setCurrentKeys([]);
      }
    }
  };

  const handleClick = () => {
    if (disabled) return;
    setIsRecording(true);
    setCurrentKeys([]);
    inputRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setHasChanges(true);
    setIsRecording(false);
    setCurrentKeys([]);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(value);
      } else {
        // Auto-save to settings if no custom onSave provided
        await updateSettingsMutation.mutateAsync({
          snippetShortcut: value, // This will be overridden by the actual field
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isRecording) {
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keyup', handleKeyUp, true);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('keyup', handleKeyUp, true);
      };
    }
  }, [isRecording]);

  const displayValue = isRecording 
    ? (currentKeys.length > 0 ? formatShortcut(currentKeys) : "Press keys...")
    : value;

  return (
    <div className={cn("relative", className)}>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={displayValue}
            placeholder={placeholder}
            readOnly
            disabled={disabled}
            onClick={handleClick}
            className={cn(
              "cursor-pointer font-mono",
              isRecording && "ring-2 ring-primary ring-offset-2",
              disabled && "cursor-not-allowed opacity-50"
            )}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
                className="h-6 w-6 p-0 hover:bg-gray-100"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            
            <div className={cn(
              "h-6 w-6 rounded border-2 border-dashed flex items-center justify-center",
              isRecording 
                ? "border-primary bg-primary/10" 
                : "border-gray-300 bg-gray-50"
            )}>
              <Keyboard className={cn(
                "h-3 w-3",
                isRecording ? "text-primary" : "text-gray-400"
              )} />
            </div>
          </div>
        </div>
        
        {showSaveButton && hasChanges && (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || updateSettingsMutation.isPending}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white"
          >
            {isSaving || updateSettingsMutation.isPending ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3 w-3" />
                Save
              </>
            )}
          </Button>
        )}
        
        {showSaveButton && !hasChanges && value && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 bg-green-50 rounded-md">
            <Check className="h-3 w-3" />
            Saved
          </div>
        )}
      </div>
      
      {isRecording && (
        <div className="absolute -bottom-8 left-0 text-xs text-primary font-medium">
          Recording... Press your desired shortcut
        </div>
      )}
    </div>
  );
} 