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

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      // Create a unique trigger using timestamp to avoid conflicts
      const timestamp = Date.now();
      const uniqueTrigger = `folder-${name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`;
      
      // For now, we'll create a dummy snippet with the folder name as category
      // In a real implementation, you might want to create a separate folders table
      return await apiRequest("POST", "/api/snippets", {
        title: `📁 ${name}`,
        content: `# ${name} Folder\n\nThis folder contains snippets organized in the ${name} category.\n\nTo add snippets to this folder, create a new snippet and select "${name}" as the category.`,
        trigger: uniqueTrigger,
        category: name,
        description: `Folder for organizing ${name} snippets`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/20 rounded-xl">
              <FolderPlus className="h-5 w-5 text-purple-400" />
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
            className="h-8 w-8 p-0 rounded-lg hover:bg-gray-700/60 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="space-y-4">
            <div>
              <label 
                className="text-[13px] font-medium text-gray-300 mb-2 block"
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
                className="rounded-xl text-[14px] border-0 bg-gray-800 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
              />
            </div>
            
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-[12px] text-gray-400" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
                <strong>Tip:</strong> Folders help organize your snippets by category. You can create folders like "React", "JavaScript", "CSS", "Python", etc.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-900/80">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="flex items-center gap-2 text-[13px] font-medium text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-xl px-4 py-2"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isCreating || !folderName.trim()}
            onClick={handleCreateFolder}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 py-2 text-[13px] font-medium"
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