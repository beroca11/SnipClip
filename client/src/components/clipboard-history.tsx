import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Trash2, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClipboardItem } from "@shared/schema";

interface ClipboardHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Custom scrollbar for clipboard history overlay */
const customScrollbar = `clipboard-scrollbar`;

export default function ClipboardHistory({ isOpen, onClose }: ClipboardHistoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clipboardItems = [], isLoading } = useQuery<ClipboardItem[]>({
    queryKey: ["/api/clipboard"],
    refetchOnWindowFocus: false,
    staleTime: 1000, // Consider data fresh for 1 second
  });

  const filteredItems = clipboardItems.filter(item =>
    item.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/clipboard/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clipboard"] });
      toast({ title: "Deleted", description: "Clipboard item deleted." });
    },
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/clipboard"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clipboard"] });
      toast({ title: "Cleared", description: "Clipboard history cleared." });
    },
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm, isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, filteredItems.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") {
      e.preventDefault();
      clearHistoryMutation.mutate();
      toast({ title: "Cleared", description: "Clipboard history cleared via shortcut." });
      return;
    }
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
      await navigator.clipboard.writeText(item.content);
      toast({ title: "Copied", description: "Clipboard item copied." });
      onClose();
    } catch (error) {
      toast({ title: "Error", description: "Failed to copy content.", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    deleteItemMutation.mutate(itemId);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="overlay-backdrop"
      onClick={(e) => {
        // Close when clicking on the backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl overflow-hidden backdrop-blur-xl"
        style={{ minHeight: 500, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the content
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border-b border-slate-700/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl backdrop-blur-sm">
                <Search className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Clipboard History</h2>
                <p className="text-sm text-slate-400">Quick access to your copied items</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md font-mono">
                {filteredItems.length} items
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 pt-4 pb-3 bg-slate-900/50">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search clipboard items..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 text-sm rounded-xl border-0 bg-slate-800/50 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:outline-none backdrop-blur-sm"
              style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            />
          </div>
        </div>

        {/* List */}
        <div className={`max-h-80 overflow-y-auto ${customScrollbar} px-2`}>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
              <div className="text-slate-400 text-sm">Loading clipboard history...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 text-sm mb-2">
                {searchTerm ? "No items match your search" : "No clipboard history found"}
              </div>
              <div className="text-slate-500 text-xs">Start copying items to see them here</div>
            </div>
          ) : (
            <ul ref={listRef} className="space-y-1">
              {filteredItems.map((item, index) => (
                <li
                  key={item.id}
                  ref={el => (itemRefs.current[index] = el)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer select-none transition-all duration-200
                    ${index === selectedIndex 
                      ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 shadow-lg" 
                      : "hover:bg-slate-800/50 border border-transparent"
                    }
                  `}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: 14 }}
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center">
                    <Copy className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-white text-sm leading-5">
                      {item.content.length > 50 ? item.content.substring(0, 50) + "..." : item.content}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 font-mono">⌘{index + 2}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-500">{item.content.length} chars</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={e => {
                        e.stopPropagation();
                        handleSelectItem(item);
                      }}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg"
                      tabIndex={-1}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={e => handleDeleteItem(e, item.id)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg"
                      disabled={deleteItemMutation.isPending}
                      tabIndex={-1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => clearHistoryMutation.mutate()}
              disabled={clearHistoryMutation.isPending}
              className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg px-3 py-2"
              style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              <Trash2 className="h-4 w-4" />
              Clear History
              <span className="text-xs text-slate-500 ml-1">(Ctrl/Cmd + Backspace)</span>
            </Button>
            <div className="flex items-center gap-3 text-sm text-slate-500" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              <span>Use ↑↓ to navigate</span>
              <span>•</span>
              <span>Enter to copy</span>
              <span>•</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
