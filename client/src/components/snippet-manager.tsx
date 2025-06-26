import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Code, Search, Plus, Edit, Trash2, Folder, Copy, FolderPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";
import type { Snippet } from "@shared/schema";

interface SnippetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onEditSnippet: (snippet: Snippet) => void;
  onNewSnippet: () => void;
}

/** Custom scrollbar for snippet browser overlay */
const customScrollbar = `clipboard-scrollbar`;

export default function SnippetManager({ isOpen, onClose, onEditSnippet, onNewSnippet }: SnippetManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const { toast } = useToast();

  const { data: snippets = [], isLoading } = useQuery<Snippet[]>({
    queryKey: ["/api/snippets"],
  });

  const deleteSnippetMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/snippets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({
        title: "Snippet deleted",
        description: "The snippet has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete snippet.",
        variant: "destructive",
      });
    },
  });

  // Memoized data processing for better performance
  const { groupedSnippets, flattenedSnippets, filteredItems } = useMemo(() => {
    // Group snippets by category, excluding folder markers
    const grouped = snippets.reduce((acc, snippet) => {
      const category = snippet.category || "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      // Only add non-folder snippets to the category list
      if (!snippet.title.startsWith('📁')) {
        acc[category].push(snippet);
      }
      return acc;
    }, {} as Record<string, Snippet[]>);

    // Flatten grouped snippets for selection
    const flattened: Array<{ type: 'category' | 'snippet', data: any, index: number }> = [];
    let globalIndex = 0;

    Object.entries(grouped).forEach(([category, categorySnippets]) => {
      // Only add category header if there are snippets in the category
      if (categorySnippets.length > 0) {
        // Add category header
        flattened.push({
          type: 'category',
          data: { name: category, count: categorySnippets.length },
          index: globalIndex++
        });
        
        // Add snippets in this category
        categorySnippets.forEach(snippet => {
          flattened.push({
            type: 'snippet',
            data: snippet,
            index: globalIndex++
          });
        });
      }
    });

    // Filter based on search term
    const filtered = searchTerm 
      ? flattened.filter(item => {
          if (item.type === 'category') {
            return item.data.name.toLowerCase().includes(searchTerm.toLowerCase());
          } else {
            const snippet = item.data as Snippet;
            return snippet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   snippet.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   snippet.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   (snippet.category && snippet.category.toLowerCase().includes(searchTerm.toLowerCase()));
          }
        })
      : flattened;

    return { groupedSnippets: grouped, flattenedSnippets: flattened, filteredItems: filtered };
  }, [snippets, searchTerm]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
      setSearchTerm("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Scroll selected item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, filteredItems.length]);

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
          const item = filteredItems[selectedIndex];
          if (item.type === 'snippet') {
            handleSelectSnippet(item.data);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "Backspace":
        if (searchTerm === "" && e.ctrlKey) {
          e.preventDefault();
          // Clear all snippets functionality could be added here
        }
        break;
    }
  };

  const handleSelectSnippet = async (snippet: Snippet) => {
    try {
      await copyToClipboard(snippet.content);
      toast({
        title: "Snippet copied",
        description: `"${snippet.title}" has been copied to clipboard.`,
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy snippet to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSnippet = async (e: React.MouseEvent, snippetId: number) => {
    e.stopPropagation();
    deleteSnippetMutation.mutate(snippetId);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      javascript: "bg-blue-100 text-blue-700",
      react: "bg-blue-100 text-blue-700",
      css: "bg-purple-100 text-purple-700",
      html: "bg-orange-100 text-orange-700",
      python: "bg-green-100 text-green-700",
      general: "bg-gray-100 text-gray-700",
      other: "bg-gray-100 text-gray-700",
    };
    return colors[category.toLowerCase()] || colors.general;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      javascript: Code,
      react: Code,
      css: Code,
      html: Code,
      python: Code,
      general: Code,
      other: Code,
    };
    return icons[category.toLowerCase()] || Code;
  };

  const totalSnippets = Object.values(groupedSnippets).reduce((sum, snippets) => sum + snippets.length, 0);

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
        className="w-full max-w-xl mx-auto rounded-2xl shadow-2xl bg-gradient-to-br from-gray-900/95 to-gray-800/95 border border-gray-700 overflow-hidden"
        style={{ minHeight: 420 }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the content
      >
        {/* Search Bar */}
        <div className="flex items-center px-6 pt-6 pb-2 bg-transparent">
          <Search className="h-5 w-5 text-gray-400 absolute ml-3" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Type to filter snippets"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10 py-3 text-[14px] rounded-xl border-0 bg-gray-800 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-primary focus:outline-none shadow-none font-sans"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
          />
        </div>

        {/* List */}
        <div
          className={`max-h-96 overflow-y-auto py-1 px-1 ${customScrollbar}`}
        >
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 text-[14px] font-sans" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>Loading snippets...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-[14px] font-sans" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
              {searchTerm ? "No snippets match your search" : "No snippets found"}
            </div>
          ) : (
            <ul ref={listRef}>
              {filteredItems.map((item, index) => {
                if (item.type === 'category') {
                  const { name, count } = item.data;
                  return (
                    <li
                      key={`category-${name}`}
                      ref={el => (itemRefs.current[index] = el)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-default transition-all select-none ${
                        index === selectedIndex
                          ? "bg-blue-600/90 text-white shadow-lg"
                          : "text-gray-300"
                      }`}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    >
                      <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-gray-700/80">
                        <Folder className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-[14px] leading-4">
                          {name}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400">
                          <span>{count} snippet{count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </li>
                  );
                } else {
                  const snippet = item.data as Snippet;
                  const contentType = getCategoryColor(snippet.category || 'General');
                  const Icon = getCategoryIcon(snippet.category || 'General');
                  return (
                    <li
                      key={snippet.id}
                      ref={el => (itemRefs.current[index] = el)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-all select-none ${
                        index === selectedIndex
                          ? "bg-blue-600/90 text-white shadow-lg"
                          : "hover:bg-gray-700/60 text-white"
                      }`}
                      onClick={() => handleSelectSnippet(snippet)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    >
                      <span className={`flex items-center justify-center h-7 w-7 rounded-lg ${contentType} bg-opacity-90`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-[14px] leading-4">
                          {snippet.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-300">
                          <Badge variant="secondary" className="bg-gray-700/80 text-gray-200 px-1.5 py-0.5 rounded-md font-medium">
                            {snippet.category || "General"}
                          </Badge>
                          {snippet.trigger && snippet.trigger.includes('-') ? (
                            <span className="font-mono text-emerald-400">
                              {snippet.trigger.split('-')[0]}
                            </span>
                          ) : (
                            <span className="font-mono">{snippet.trigger}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 ml-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleSelectSnippet(snippet);
                          }}
                          className="h-6 w-6 p-0 text-emerald-400 hover:text-emerald-300"
                          tabIndex={-1}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            onEditSnippet(snippet);
                          }}
                          className="h-6 w-6 p-0 text-blue-400 hover:text-blue-300"
                          tabIndex={-1}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => handleDeleteSnippet(e, snippet.id)}
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                          disabled={deleteSnippetMutation.isPending}
                          tabIndex={-1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[10px] text-gray-400 font-mono">⌘{index + 2}</span>
                      </div>
                    </li>
                  );
                }
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-700 bg-gray-900/80">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onNewSnippet}
              className="flex items-center gap-2 text-[12px] font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg px-3 py-1.5"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Snippet
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-gray-400" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
            <span>{totalSnippets} snippets</span>
            <span>•</span>
            <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded font-mono text-[10px]">Esc</kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
