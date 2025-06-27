import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Code, 
  Plus, 
  Edit, 
  Trash2, 
  Folder, 
  Copy, 
  FolderPlus, 
  Search,
  ArrowLeft,
  Keyboard,
  Settings
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";
import SnippetEditor from "@/components/snippet-editor";
import FolderCreationModal from "@/components/folder-creation-modal";
import type { Snippet } from "@shared/schema";

export default function SnippetsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [snippetEditorOpen, setSnippetEditorOpen] = useState(false);
  const [folderCreationModalOpen, setFolderCreationModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
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

  // Get unique categories (exclude folders)
  const categories = [
    "All",
    ...Array.from(
      new Set(
        snippets
          .filter(s => !s.title.startsWith('📁') && !(s.trigger && s.trigger.startsWith('__folder__')))
          .map(s => s.category || "General")
      )
    ),
  ].sort();

  // Filter snippets based on search and category, and exclude folder markers from the grid
  const filteredSnippets = snippets.filter(snippet => {
    // Exclude folder marker snippets
    const isFolderMarker = snippet.title.startsWith('📁') || (snippet.trigger && snippet.trigger.startsWith('__folder__'));
    if (isFolderMarker) return false;

    const matchesSearch = searchTerm === "" || 
      snippet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      snippet.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      snippet.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (snippet.category && snippet.category.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "All" || snippet.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleEditSnippet = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setSnippetEditorOpen(true);
  };

  const handleNewSnippet = () => {
    setEditingSnippet(null);
    setSnippetEditorOpen(true);
  };

  const handleCreateFolder = () => {
    setFolderCreationModalOpen(true);
    // After modal closes, refetch snippets (which will update categories)
    // This is handled by react-query's invalidateQueries in the modal's onSuccess
  };

  const handleSelectSnippet = async (snippet: Snippet) => {
    try {
      await copyToClipboard(snippet.content);
      toast({
        title: "Snippet copied",
        description: `"${snippet.title}" has been copied to clipboard.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy snippet to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSnippet = async (snippetId: number) => {
    deleteSnippetMutation.mutate(snippetId);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      javascript: "bg-blue-100 text-blue-700 border-blue-200",
      react: "bg-blue-100 text-blue-700 border-blue-200",
      css: "bg-purple-100 text-purple-700 border-purple-200",
      html: "bg-orange-100 text-orange-700 border-orange-200",
      python: "bg-green-100 text-green-700 border-green-200",
      general: "bg-gray-100 text-gray-700 border-gray-200",
      other: "bg-gray-100 text-gray-700 border-gray-200",
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

  const totalSnippets = snippets.length;
  const snippetsWithShortcuts = snippets.filter(s => s.trigger && s.trigger.includes('-')).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Snippet Management</h1>
              <p className="text-lg text-gray-500 mt-1">Organize and manage your code snippets</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button
              onClick={handleNewSnippet}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-xl px-6 py-2 text-base font-semibold transition-all duration-150"
              style={{ boxShadow: '0 4px 16px 0 rgba(37, 99, 235, 0.10)' }}
            >
              <Plus className="h-5 w-5" />
              New Snippet
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-md rounded-2xl bg-white">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-xl mr-4">
                  <Code className="text-blue-600 h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Snippets</p>
                  <p className="text-2xl font-extrabold text-gray-900">{totalSnippets}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md rounded-2xl bg-white">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-emerald-100 rounded-xl mr-4">
                  <Keyboard className="text-emerald-600 h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">With Shortcuts</p>
                  <p className="text-2xl font-extrabold text-gray-900">{snippetsWithShortcuts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md rounded-2xl bg-white">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-xl mr-4">
                  <Folder className="text-purple-600 h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Categories</p>
                  <p className="text-2xl font-extrabold text-gray-900">{categories.length - 1}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md rounded-2xl bg-white">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-orange-100 rounded-xl mr-4">
                  <Settings className="text-orange-600 h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Active</p>
                  <p className="text-2xl font-extrabold text-gray-900">{filteredSnippets.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="border-0 shadow-md rounded-2xl bg-white mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <Input
                    placeholder="Search snippets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-100 border-0 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    onClick={() => setSelectedCategory(category)}
                    className={`text-sm rounded-xl px-4 py-2 ${selectedCategory === category ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 border-0 hover:bg-blue-50'}`}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Snippets Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading snippets...</p>
          </div>
        ) : filteredSnippets.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || selectedCategory !== "All" ? "No snippets found" : "No snippets yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || selectedCategory !== "All" 
                  ? "Try adjusting your search or category filter"
                  : "Create your first snippet to get started"
                }
              </p>
              <Button onClick={handleNewSnippet} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create First Snippet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSnippets.map((snippet) => {
              const Icon = getCategoryIcon(snippet.category || 'General');
              const hasShortcut = snippet.trigger && snippet.trigger.includes('-');
              const shortcut = hasShortcut ? snippet.trigger.split('-')[0] : null;
              
              return (
                <Card key={snippet.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getCategoryColor(snippet.category || 'General')}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{snippet.title}</CardTitle>
                          <Badge variant="secondary" className="mt-1">
                            {snippet.category || "General"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSelectSnippet(snippet)}
                          className="h-8 w-8"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditSnippet(snippet)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteSnippet(snippet.id)}
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          disabled={deleteSnippetMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {snippet.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {snippet.description}
                        </p>
                      )}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <pre className="text-sm text-gray-700 font-mono line-clamp-3 overflow-hidden">
                          {snippet.content}
                        </pre>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          {hasShortcut ? (
                            <div className="flex items-center gap-1">
                              <Keyboard className="h-3 w-3" />
                              <kbd className="px-1.5 py-0.5 bg-gray-200 border border-gray-300 rounded font-mono">
                                {shortcut}
                              </kbd>
                            </div>
                          ) : (
                            <span className="font-mono">{snippet.trigger}</span>
                          )}
                        </div>
                        <span>
                          {new Date(snippet.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <SnippetEditor
        isOpen={snippetEditorOpen}
        onClose={() => {
          setSnippetEditorOpen(false);
          setEditingSnippet(null);
        }}
        editingSnippet={editingSnippet}
      />

      <FolderCreationModal
        isOpen={folderCreationModalOpen}
        onClose={() => setFolderCreationModalOpen(false)}
      />
    </div>
  );
} 