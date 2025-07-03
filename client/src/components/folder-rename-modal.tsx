import React, { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FolderRenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number | null;
  currentName: string;
}

export default function FolderRenameModal({ isOpen, onClose, folderId, currentName }: FolderRenameModalProps) {
  const [folderName, setFolderName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && currentName) {
      setFolderName(currentName);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, currentName]);

  const renameFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!folderId) throw new Error("No folder ID provided");
      return await apiRequest("PUT", `/api/folders/${folderId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Folder renamed",
        description: `Folder has been renamed to "${folderName}" successfully.`,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to rename folder",
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
      handleRenameFolder();
    }
  };

  const handleRenameFolder = async () => {
    if (!folderName.trim() || !folderId) return;
    
    // Prevent renaming to "General"
    if (folderName.trim().toLowerCase() === "general") {
      toast({
        title: "Invalid folder name",
        description: '"General" is a reserved name for the default folder. Please choose a different name.',
        variant: "destructive",
      });
      return;
    }
    
    // Don't rename if the name hasn't changed
    if (folderName.trim() === currentName) {
      handleClose();
      return;
    }
    
    setIsRenaming(true);
    try {
      await renameFolderMutation.mutateAsync(folderName.trim());
    } finally {
      setIsRenaming(false);
    }
  };

  const handleClose = () => {
    setFolderName("");
    onClose();
  };

  if (!isOpen || !folderId) return null;

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
              <Edit className="h-5 w-5 text-blue-400" />
            </div>
            <h2 
              className="text-[18px] font-semibold text-white"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >
              Rename Folder
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
        <div className="flex-1 px-6 py-6">
          <div className="space-y-4">
            <div>
              <label 
                className="text-[13px] font-medium text-blue-200 mb-2 block"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
              >
                New Folder Name
              </label>
              <Input
                ref={inputRef}
                type="text"
                placeholder="Enter new folder name"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                className="rounded-xl text-[14px] border-0 bg-blue-900/50 text-white placeholder:text-blue-300/60 focus:ring-2 focus:ring-blue-400 focus:outline-none border border-blue-700/30"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
              />
            </div>
            
            <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700/20">
              <p className="text-[12px] text-blue-300/80" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
                <strong>Current name:</strong> <span className="text-blue-200">{currentName}</span>
              </p>
              <p className="text-[12px] text-blue-300/80 mt-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
                <strong>Note:</strong> "General" is a reserved name and cannot be used.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-6">
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
            disabled={isRenaming || !folderName.trim() || folderName.trim() === currentName}
            onClick={handleRenameFolder}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl px-6 py-2 text-[13px] font-medium shadow-lg transition-all duration-150"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
          >
            <Edit className="h-4 w-4" />
            {isRenaming ? "Renaming..." : "Rename Folder"}
          </Button>
        </div>
      </div>
    </div>
  );
} 