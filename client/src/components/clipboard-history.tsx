import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Trash2, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClipboardItem } from "@shared/schema";
import SnippetList from "./SnippetList";

interface ClipboardHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Custom scrollbar for clipboard history overlay */
const customScrollbar = `clipboard-scrollbar`;

export default function ClipboardHistory({ isOpen, onClose }: ClipboardHistoryProps) {
  const overlayInstance = Math.random().toString(36).slice(2, 8);
  console.log('ClipboardHistory rendered', overlayInstance);
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
      className="overlay-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 border border-blue-700/60 shadow-2xl overflow-hidden backdrop-blur-xl scale-100 animate-scale-in"
        style={{ minHeight: 500, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif', fontSize: 18 }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-700/40 via-indigo-700/30 to-slate-800/40 border-b border-blue-800/40">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/30 rounded-xl backdrop-blur-sm">
                <Search className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Clipboard History</h2>
                <p className="text-base text-blue-200">Quick access to your copied items</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-200 bg-blue-800/40 px-3 py-1 rounded-md font-mono">
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
            <SnippetList
              items={filteredItems}
              type="clipboard"
              onCopy={async (item) => {
                await navigator.clipboard.writeText(item.content);
                toast({ title: "Copied", description: "Clipboard item copied." });
                onClose();
              }}
              onDelete={(id) => deleteItemMutation.mutate(id)}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
            />
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
