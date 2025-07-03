import React, { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderPlus, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FolderCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FolderCreationModal({ isOpen, onClose }: FolderCreationModalProps) {
  const [folderName, setFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setFolderName("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      // Use the new folders API
      return await apiRequest("POST", "/api/folders", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Folder created",
        description: `"${folderName}" folder has been created successfully.`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder",
        variant: "destructive",
      });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    } else if (e.key === "Enter" && folderName.trim()) {
      e.preventDefault();
      handleCreateFolder();
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    
    // Prevent creating a folder named "General"
    if (folderName.trim().toLowerCase() === "general") {
      toast({
        title: "Invalid folder name",
        description: '"General" is a reserved name for the default folder. Please choose a different name.',
        variant: "destructive",
      });
      return;
    }
    
    setIsCreating(true);
    try {
      await createFolderMutation.mutateAsync(folderName.trim());
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setFolderName("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop">
      <div
        className="overlay-content-dark max-w-md mx-4"
        style={{ minHeight: 300 }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-blue-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <FolderPlus className="h-5 w-5 text-blue-400" />
            </div>
            <h2 
              className="text-[18px] font-semibold text-white"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >
              Create New Folder
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0 rounded-lg hover:bg-blue-800/40 text-blue-300 hover:text-white transition-all duration-150"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="space-y-4">
            <div>
              <label 
                className="text-[13px] font-medium text-blue-200 mb-2 block"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
              >
                Folder Name
              </label>
              <Input
                ref={inputRef}
                type="text"
                placeholder="Enter folder name (e.g., React, JavaScript, CSS)"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                className="rounded-xl text-[14px] border-0 bg-blue-900/50 text-white placeholder:text-blue-300/60 focus:ring-2 focus:ring-blue-400 focus:outline-none border border-blue-700/30"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
              />
            </div>
            
            <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700/20">
              <p className="text-[12px] text-blue-300/80" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
                <strong>Tip:</strong> Create folders to organize your snippets by category. "General" is your default folder. 
                Try names like "React", "JavaScript", "CSS", "Python", "Work", "Personal", etc.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-blue-800/30 bg-gradient-to-r from-blue-900/80 to-blue-800/80">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="flex items-center gap-2 text-[13px] font-medium text-blue-300 hover:text-white hover:bg-blue-700/40 rounded-xl px-4 py-2 transition-all duration-150"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isCreating || !folderName.trim()}
            onClick={handleCreateFolder}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl px-6 py-2 text-[13px] font-medium shadow-lg transition-all duration-150"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
          >
            <FolderPlus className="h-4 w-4" />
            {isCreating ? "Creating..." : "Create Folder"}
          </Button>
        </div>
      </div>
    </div>
  );
} 