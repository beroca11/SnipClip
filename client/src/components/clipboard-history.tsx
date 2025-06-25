import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Search, Copy, Trash2, TrashIcon, Code, Link, Type } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";
import type { ClipboardItem } from "@shared/schema";

interface ClipboardHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClipboardHistory({ isOpen, onClose }: ClipboardHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: clipboardItems = [], isLoading } = useQuery<ClipboardItem[]>({
    queryKey: ["/api/clipboard"],
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clipboard/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clipboard"] });
      toast({
        title: "Item removed",
        description: "Clipboard item has been removed from history.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove clipboard item.",
        variant: "destructive",
      });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/clipboard"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clipboard"] });
      toast({
        title: "History cleared",
        description: "All clipboard history has been cleared.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear clipboard history.",
        variant: "destructive",
      });
    },
  });

  const filteredItems = clipboardItems.filter(item =>
    item.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    setSelectedIndex(0);
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelectItem(filteredItems[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  const handleSelectItem = async (item: ClipboardItem) => {
    try {
      await copyToClipboard(item.content);
      toast({
        title: "Content copied",
        description: "Clipboard item has been copied.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy content to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    deleteItemMutation.mutate(itemId);
  };

  const detectContentType = (content: string): { type: string; icon: any; color: string } => {
    if (content.match(/^https?:\/\//)) {
      return { type: "URL", icon: Link, color: "bg-purple-100 text-purple-700" };
    }
    if (content.includes("function") || content.includes("const") || content.includes("=>") || content.includes("class")) {
      return { type: "Code", icon: Code, color: "bg-blue-100 text-blue-700" };
    }
    return { type: "Text", icon: Type, color: "bg-green-100 text-green-700" };
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.round((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.round(diffInMinutes / 60)} hr ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl border-0" onKeyDown={handleKeyDown}>
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="p-2 bg-blue-50 rounded-xl">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            Clipboard History
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="border-b border-gray-100 pb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search clipboard history..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 py-3 text-base rounded-xl border-gray-200 focus:border-primary focus:ring-primary"
            />
          </div>
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>{filteredItems.length} items in clipboard history</span>
            <div className="flex gap-2">
              <span>Use ↑↓ to navigate</span>
              <span>•</span>
              <span>Enter to paste</span>
            </div>
          </div>
        </div>

        {/* Clipboard List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading clipboard history...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No items match your search" : "No clipboard history found"}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const contentType = detectContentType(item.content);
              const Icon = contentType.icon;
              
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl cursor-pointer border transition-all group ${
                    index === selectedIndex
                      ? "bg-blue-50 border-primary shadow-sm"
                      : "border-gray-100 hover:bg-gray-50 hover:border-primary hover:shadow-sm"
                  }`}
                  onClick={() => handleSelectItem(item)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="text-gray-400 h-4 w-4" />
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(item.createdAt)}
                        </span>
                        <Badge variant="secondary" className={`text-xs ${contentType.color}`}>
                          {contentType.type}
                        </Badge>
                      </div>
                      <div className={`rounded-md p-3 text-xs max-h-24 overflow-hidden ${
                        contentType.type === "Code" 
                          ? "bg-gray-900 text-gray-300 font-mono" 
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {contentType.type === "Code" ? (
                          <pre className="whitespace-pre-wrap">{item.content}</pre>
                        ) : (
                          <p className="whitespace-pre-wrap">{item.content}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item);
                        }}
                        className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleDeleteItem(e, item.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        disabled={deleteItemMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-100 bg-gray-50 -mx-6 -mb-6 px-6 py-5 rounded-b-2xl">
          <Button
            variant="ghost"
            onClick={() => clearHistoryMutation.mutate()}
            disabled={clearHistoryMutation.isPending}
            className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl px-4 py-2"
          >
            <TrashIcon className="h-4 w-4" />
            Clear History
          </Button>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <kbd className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg font-mono text-xs">Esc</kbd>
            <span>to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
