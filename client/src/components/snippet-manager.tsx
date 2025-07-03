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
import SnippetList from "./SnippetList";

interface SnippetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onEditSnippet: (snippet: Snippet) => void;
  onNewSnippet: () => void;
}

/** Custom scrollbar for snippet browser overlay */
const customScrollbar = `clipboard-scrollbar`;

export default function SnippetManager({ isOpen, onClose, onEditSnippet, onNewSnippet }: SnippetManagerProps) {
  const overlayInstance = Math.random().toString(36).slice(2, 8);
  console.log('SnippetManager rendered', overlayInstance);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
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
    if (filteredItems[selectedIndex]) {
      listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
      className="overlay-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-3xl mx-4 rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 border border-blue-700/60 shadow-2xl overflow-hidden backdrop-blur-xl scale-100 animate-scale-in"
        style={{ minHeight: 600, fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif', fontSize: 18 }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-700/40 via-indigo-700/30 to-slate-800/40 border-b border-blue-800/40">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/30 rounded-xl backdrop-blur-sm">
                <Code className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Snippet Manager</h2>
                <p className="text-base text-blue-200">Organize and access your code snippets</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-200 bg-blue-800/40 px-3 py-1 rounded-md font-mono">
                {totalSnippets} snippets
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
              placeholder="Search snippets by title, content, or category..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 text-sm rounded-xl border-0 bg-slate-800/50 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none backdrop-blur-sm"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            />
          </div>
        </div>

        {/* List */}
        <div
          className={`max-h-96 overflow-y-auto ${customScrollbar} px-2`}
        >
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-3"></div>
              <div className="text-slate-400 text-sm">Loading snippets...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 text-sm mb-2">
                {searchTerm ? "No snippets match your search" : "No snippets found"}
              </div>
              <div className="text-slate-500 text-xs">Create your first snippet to get started</div>
            </div>
          ) : (
            <SnippetList
              items={filteredItems.filter(item => item.type === 'snippet').map(item => item.data)}
              type="snippet"
              onCopy={async (snippet) => {
                await copyToClipboard(snippet.content);
                toast({
                  title: "Snippet copied",
                  description: `\"${snippet.title}\" has been copied to clipboard.`,
                });
                onClose();
                          }}
              onEdit={onEditSnippet}
              onDelete={(id) => deleteSnippetMutation.mutate(id)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={onNewSnippet}
              className="flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 rounded-lg px-3 py-2"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >
              <Plus className="h-4 w-4" />
              New Snippet
            </Button>
            <div className="flex items-center gap-3 text-sm text-slate-500" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
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
