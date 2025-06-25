import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Code, Search, Plus, Edit, Trash2, X } from "lucide-react";
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

export default function SnippetManager({ isOpen, onClose, onEditSnippet, onNewSnippet }: SnippetManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
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

  const filteredSnippets = snippets.filter(snippet =>
    snippet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    snippet.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    snippet.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (snippet.category && snippet.category.toLowerCase().includes(searchTerm.toLowerCase()))
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
        setSelectedIndex(prev => Math.min(prev + 1, filteredSnippets.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredSnippets[selectedIndex]) {
          handleSelectSnippet(filteredSnippets[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
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
      template: "bg-green-100 text-green-700",
      debug: "bg-yellow-100 text-yellow-700",
      other: "bg-gray-100 text-gray-700",
    };
    return colors[category] || colors.other;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Code className="h-5 w-5 text-blue-600" />
            Code Snippets
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="border-b border-gray-200 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search snippets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>{filteredSnippets.length} snippets found</span>
            <div className="flex gap-2">
              <span>Use ↑↓ to navigate</span>
              <span>•</span>
              <span>Enter to select</span>
            </div>
          </div>
        </div>

        {/* Snippet List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading snippets...</div>
          ) : filteredSnippets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No snippets match your search" : "No snippets found"}
            </div>
          ) : (
            filteredSnippets.map((snippet, index) => (
              <div
                key={snippet.id}
                className={`p-3 rounded-lg cursor-pointer border-l-4 transition-all group ${
                  index === selectedIndex
                    ? "bg-blue-50 border-blue-500"
                    : "border-transparent hover:bg-gray-50 hover:border-blue-500"
                }`}
                onClick={() => handleSelectSnippet(snippet)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 text-sm">{snippet.title}</h3>
                      {snippet.category && (
                        <Badge variant="secondary" className={`text-xs ${getCategoryColor(snippet.category)}`}>
                          {snippet.category}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500">Trigger:</span>
                      <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                        {snippet.trigger}
                      </kbd>
                    </div>
                    <div className="bg-gray-900 rounded-md p-3 text-xs font-mono text-gray-300 overflow-hidden max-h-24">
                      <pre className="whitespace-pre-wrap">{snippet.content}</pre>
                    </div>
                    {snippet.description && (
                      <p className="text-xs text-gray-500 mt-2">{snippet.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSnippet(snippet);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleDeleteSnippet(e, snippet.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      disabled={deleteSnippetMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
          <Button
            variant="ghost"
            onClick={onNewSnippet}
            className="flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            New Snippet
          </Button>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded font-mono">Esc</kbd>
            <span>to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
