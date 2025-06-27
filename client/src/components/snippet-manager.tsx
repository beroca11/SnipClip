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
      className="overlay-backdrop"
      onClick={(e) => {
        // Close when clicking on the backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-3xl mx-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl overflow-hidden backdrop-blur-xl"
        style={{ minHeight: 600 }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the content
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-emerald-600/20 via-blue-600/20 to-purple-600/20 border-b border-slate-700/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-xl backdrop-blur-sm">
                <Code className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Snippet Manager</h2>
                <p className="text-sm text-slate-400">Organize and access your code snippets</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md font-mono">
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
            <ul ref={listRef} className="space-y-1">
              {filteredItems.map((item, index) => {
                if (item.type === 'category') {
                  const { name, count } = item.data;
                  return (
                    <li
                      key={`category-${name}`}
                      ref={el => (itemRefs.current[index] = el)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-default transition-all duration-200 ${
                        index === selectedIndex
                          ? "bg-gradient-to-r from-slate-700/50 to-slate-600/50 border border-slate-600/50 shadow-lg"
                          : "text-slate-300"
                      }`}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-slate-700/50 rounded-lg flex items-center justify-center">
                        <Folder className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-semibold text-white text-sm leading-5">
                          {name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{count} snippet{count !== 1 ? 's' : ''}</span>
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
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                        index === selectedIndex
                          ? "bg-gradient-to-r from-emerald-600/20 to-blue-600/20 border border-emerald-500/30 shadow-lg"
                          : "hover:bg-slate-800/50 border border-transparent"
                      }`}
                      onClick={() => handleSelectSnippet(snippet)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${contentType} bg-opacity-90`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-white text-sm leading-5">
                          {snippet.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="bg-slate-700/50 text-slate-200 px-2 py-0.5 rounded-md font-medium text-xs">
                            {snippet.category || "General"}
                          </Badge>
                          {snippet.trigger && (
                            <>
                              <span className="text-xs text-slate-500">•</span>
                              <span className="text-xs font-mono text-emerald-400">
                                {snippet.trigger.includes('-') ? snippet.trigger.split('-')[0] : snippet.trigger}
                              </span>
                            </>
                          )}
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs text-slate-500 font-mono">⌘{index + 2}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            handleSelectSnippet(snippet);
                          }}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/20 rounded-lg"
                          tabIndex={-1}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation();
                            onEditSnippet(snippet);
                          }}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-lg"
                          tabIndex={-1}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={e => handleDeleteSnippet(e, snippet.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg"
                          disabled={deleteSnippetMutation.isPending}
                          tabIndex={-1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                }
              })}
            </ul>
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
