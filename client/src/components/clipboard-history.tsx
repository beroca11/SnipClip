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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        // Close when clicking on the backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-xl mx-auto rounded-xl bg-[#232323]/95 border border-[#232323] shadow-none overflow-hidden"
        style={{ minHeight: 420, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the content
      >
        {/* Search Bar */}
        <div className="flex items-center px-5 pt-5 pb-2 bg-transparent">
          <Search className="h-4 w-4 text-gray-400 absolute ml-3" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Type to filter clipboard and snippets"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 py-2.5 text-[15px] rounded-md border-0 bg-[#232323] text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-none font-sans"
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
          />
        </div>

        {/* List */}
        <div className={`max-h-96 overflow-y-auto py-1 px-1 ${customScrollbar}`}>
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 text-[15px] font-sans">Loading clipboard history...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-[15px] font-sans">
              {searchTerm ? "No items match your search" : "No clipboard history found"}
            </div>
          ) : (
            <ul ref={listRef}>
              {filteredItems.map((item, index) => (
                <li
                  key={item.id}
                  ref={el => (itemRefs.current[index] = el)}
                  className={`flex items-center px-4 py-2.5 rounded-none cursor-pointer select-none transition-colors
                    ${index === selectedIndex ? "bg-[#3a3a3a] text-white" : "text-gray-100 hover:bg-[#292929]"}
                    border-b border-[#232323] last:border-b-0
                  `}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: 15 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-normal text-[15px] leading-5">
                      {item.content.length > 60 ? item.content.substring(0, 60) + "..." : item.content}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={e => {
                        e.stopPropagation();
                        handleSelectItem(item);
                      }}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                      tabIndex={-1}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={e => handleDeleteItem(e, item.id)}
                      className="h-6 w-6 p-0 text-gray-500 hover:text-red-400"
                      disabled={deleteItemMutation.isPending}
                      tabIndex={-1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <span className="text-[12px] text-gray-500 font-mono mt-1" style={{ minWidth: 32, textAlign: 'right' }}>⌘{index + 2}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#232323] bg-[#232323]/95">
          <Button
            variant="ghost"
            onClick={() => clearHistoryMutation.mutate()}
            disabled={clearHistoryMutation.isPending}
            className="flex items-center gap-2 text-[14px] font-normal text-gray-400 hover:text-red-400 hover:bg-transparent px-0 py-0"
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
          >
            <Trash2 className="h-4 w-4" />
            Clear History
            <span className="ml-2 text-[12px] text-gray-500">(Ctrl/Cmd + Backspace)</span>
          </Button>
          <div className="flex items-center gap-2 text-[13px] text-gray-500 font-normal" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
