import React, { useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Label } from "./label";
import { ShortcutInput } from "./shortcut-input";
import { ShortcutTester } from "./shortcut-tester";
import { Save, X, Keyboard } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertSettings } from "@shared/schema";

interface ShortcutEditorProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  shortcutType: "snippet" | "clipboard";
  currentShortcut: string;
}

export function ShortcutEditor({ 
  isOpen, 
  onClose, 
  title = "Edit Shortcut",
  shortcutType,
  currentShortcut 
}: ShortcutEditorProps) {
  const [shortcut, setShortcut] = useState(currentShortcut);
  const [hasChanges, setHasChanges] = useState(false);
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
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save shortcut",
        variant: "destructive",
      });
    },
  });

  const handleShortcutChange = (value: string) => {
    setShortcut(value);
    setHasChanges(value !== currentShortcut);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    const updateData = shortcutType === "snippet" 
      ? { snippetShortcut: shortcut }
      : { clipboardShortcut: shortcut };
    
    await updateSettingsMutation.mutateAsync(updateData);
  };

  const handleClose = () => {
    setShortcut(currentShortcut);
    setHasChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>
              {shortcutType === "snippet" ? "Snippets" : "Clipboard History"} Shortcut
            </Label>
            <ShortcutInput
              value={shortcut}
              onChange={handleShortcutChange}
              placeholder="Press keys to set shortcut..."
              className="w-full"
            />
          </div>

          <ShortcutTester 
            shortcut={shortcut} 
            onTrigger={() => {
              toast({
                title: "Shortcut Test",
                description: `${shortcutType === "snippet" ? "Snippets" : "Clipboard"} shortcut works!`,
              });
            }}
          />

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateSettingsMutation.isPending}
              className="flex-1"
            >
              {updateSettingsMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 