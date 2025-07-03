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
  Settings,
  ChevronDown,
  ChevronRight,
  Save
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";
import SnippetEditor from "@/components/snippet-editor";
import FolderCreationModal from "@/components/folder-creation-modal";
import FolderRenameModal from "@/components/folder-rename-modal";
import type { Snippet } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper: Render the folder list
function FolderList({ folders, selectedId, onSelect, onRename, onDelete, onCreateFolder }:{ folders: { id: number|null, name: string }[], selectedId: number|null, onSelect: (id: number|null) => void, onRename: (id: number|null, name: string) => void, onDelete: (id: number|null) => void, onCreateFolder: () => void }) {
  return (
    <ul className="space-y-1">
      {folders.map(folder => {
        const isGeneralFolder = folder.name === "General";
        const isSelected = selectedId === folder.id;
        
        return (
          <li key={folder.id ?? 'general'}>
            <div className={`flex items-center gap-1 cursor-pointer rounded-lg px-3 py-2 transition-all duration-150 ${
              isSelected 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' 
                : 'hover:bg-blue-50 text-gray-700 hover:text-gray-900'
            }`}
                 onClick={() => onSelect(folder.id)}>
              <Folder className={`h-4 w-4 mr-2 ${isGeneralFolder ? 'text-blue-500' : 'text-purple-500'}`} />
              <span className="truncate flex-1 font-medium">{folder.name}</span>
              
              {/* Only show action buttons if not General folder */}
              {!isGeneralFolder && (
                <>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className={`${isSelected ? 'text-white hover:bg-blue-600' : 'text-blue-600 hover:text-blue-800'}`} 
                    onClick={e => { e.stopPropagation(); onRename(folder.id, folder.name); }}
                    title="Rename folder"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className={`${isSelected ? 'text-white hover:bg-blue-600' : 'text-red-600 hover:text-red-800'}`} 
                    onClick={e => { 
                      e.stopPropagation(); 
                      if (window.confirm(`Delete "${folder.name}" folder and move all its snippets to General?`)) {
                        onDelete(folder.id); 
                      }
                    }}
                    title="Delete folder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              {/* Show special indicator for General folder */}
              {isGeneralFolder && (
                <div className="flex items-center gap-1">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                    Default
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Find folder name by id
function getFolderName(folderId: number|null, folders: {id: number, name: string}[]) {
  if (folderId == null) return 'General';
  const folder = folders.find(f => f.id === folderId);
  return folder ? folder.name : 'Unknown';
}

export default function SnippetsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [snippetEditorOpen, setSnippetEditorOpen] = useState(false);
  const [folderCreationModalOpen, setFolderCreationModalOpen] = useState(false);
  const [folderRenameModalOpen, setFolderRenameModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState("");
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null);
  const [moveSnippetId, setMoveSnippetId] = useState<number | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch folders
  const { data: folders = [], isLoading: isLoadingFolders } = useQuery<any[]>({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      return res.json();
    },
  });

  // Fetch snippets for selected folder
  const { data: snippets = [], isLoading: isLoadingSnippets } = useQuery<Snippet[]>({
    queryKey: ["/api/snippets", selectedFolderId],
    queryFn: async () => {
      const url = selectedFolderId ? `/api/snippets?folderId=${selectedFolderId}` : "/api/snippets";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: !!selectedFolderId,
  });

  // Select General folder by default
  useEffect(() => {
    if (folders.length > 0 && selectedFolderId === null) {
      const general = folders.find(f => f.name === "General");
      if (general) setSelectedFolderId(general.id);
    }
  }, [folders, selectedFolderId]);

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

  // Folder mutations
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setDeletingFolderId(null);
      // If deleted folder was selected, select General
      if (selectedFolderId === deletingFolderId) {
        const general = folders.find(f => f.name === "General");
        if (general) setSelectedFolderId(general.id);
      }
    },
  });

  const moveSnippetMutation = useMutation({
    mutationFn: async ({ snippetId, folderId }: { snippetId: number; folderId: number }) => {
      await apiRequest("PUT", `/api/snippets/${snippetId}`, { folderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets", selectedFolderId] });
      setMoveSnippetId(null);
      setMoveTargetFolderId(null);
    },
  });

  // Find the real General folder from the folders array
  const generalFolder = folders.find(f => f.name === 'General');

  // Filter snippets by selected folder (use real General folder id)
  const filteredSnippets = snippets.filter(snippet => snippet.folderId === selectedFolderId)
    .filter(snippet => {
      const matchesSearch = searchTerm === "" || 
        snippet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        snippet.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        snippet.trigger.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
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

  // Fix: wrap deleteFolderMutation.mutate to only call with a number
  const handleDeleteFolder = (id: number|null) => {
    if (typeof id === 'number') {
      // Find the folder to be deleted
      const folderToDelete = folders.find(f => f.id === id);
      
      // Protect the General folder from deletion
      if (folderToDelete && folderToDelete.name === "General") {
        toast({
          title: "Cannot delete default folder",
          description: "The General folder is protected and cannot be deleted.",
          variant: "destructive",
        });
        return;
      }
      
      // For other folders, move their snippets to General before deletion
      if (folderToDelete) {
        const generalFolder = folders.find(f => f.name === "General");
        if (generalFolder) {
          // Move all snippets from the folder to General
          const snippetsInFolder = snippets.filter(s => s.folderId === id);
          Promise.all(
            snippetsInFolder.map(snippet => 
              apiRequest("PUT", `/api/snippets/${snippet.id}`, { folderId: generalFolder.id })
            )
          ).then(() => {
            // After moving snippets, delete the folder
            deleteFolderMutation.mutate(id);
          }).catch(error => {
            console.error("Error moving snippets:", error);
            toast({
              title: "Error",
              description: "Failed to move snippets to General folder.",
              variant: "destructive",
            });
          });
        } else {
          // If no General folder exists, just delete the folder
          deleteFolderMutation.mutate(id);
        }
      }
    }
  };

  // Add protection for renaming General folder
  const handleRenameFolder = (id: number|null, currentName: string) => {
    if (currentName === "General") {
      toast({
        title: "Cannot rename default folder",
        description: "The General folder name is protected and cannot be changed.",
        variant: "destructive",
      });
      return;
    }
    setRenamingFolderId(id);
    setRenamingFolderName(currentName);
    setFolderRenameModalOpen(true);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 via-white to-gray-50" style={{ fontFamily: 'SF Pro Display, SF Pro Icons, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <div className="p-8 max-w-7xl mx-auto flex flex-row gap-8 items-start">
        {/* Sidebar: Glassy, blurred, soft border */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl shadow-lg p-4 sticky top-8" style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.10)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Folders</h2>
              <Button size="icon" variant="ghost" onClick={handleCreateFolder} className="text-blue-600 hover:text-blue-800 rounded-full transition-all duration-150">
                <FolderPlus className="h-5 w-5" />
              </Button>
            </div>
            <FolderList
              folders={folders}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
              onCreateFolder={() => setFolderCreationModalOpen(true)}
            />
          </div>
        </aside>
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => window.history.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 rounded-full px-3 py-1 transition-all duration-150"
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
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full px-6 py-2 text-base font-semibold transition-all duration-150"
                style={{ boxShadow: '0 4px 16px 0 rgba(37, 99, 235, 0.10)' }}
              >
                <Plus className="h-5 w-5" />
                New Snippet
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="border-0 shadow-md rounded-2xl bg-white/70 backdrop-blur-md">
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
            <Card className="border-0 shadow-md rounded-2xl bg-white/70 backdrop-blur-md">
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
            <Card className="border-0 shadow-md rounded-2xl bg-white/70 backdrop-blur-md">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-xl mr-4">
                    <Folder className="text-purple-600 h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Categories</p>
                    <p className="text-2xl font-extrabold text-gray-900">{folders.length - 1}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md rounded-2xl bg-white/70 backdrop-blur-md">
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
          <Card className="border-0 shadow-md rounded-2xl bg-white/70 backdrop-blur-md mb-6">
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
              </div>
            </CardContent>
          </Card>

          {/* Snippets List/Table */}
          {isLoadingSnippets ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading snippets...</p>
            </div>
          ) : filteredSnippets.length === 0 ? (
            <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-md">
              <CardContent className="p-12 text-center">
                <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? "No snippets found" : "No snippets yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm ? "Try adjusting your search" : "Create your first snippet to get started"}
                </p>
                <Button onClick={handleNewSnippet} className="flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 shadow-md transition-all duration-150">
                  <Plus className="h-4 w-4" />
                  Create First Snippet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="w-full">
              <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg p-4">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-700 font-semibold">
                      <th className="py-3 px-2 w-1/6">Name</th>
                      <th className="py-3 px-2 w-2/6">Content</th>
                      <th className="py-3 px-2 w-1/6">Folder</th>
                      <th className="py-3 px-2 w-1/6 text-right">Date Modified</th>
                      <th className="py-3 px-2 w-1/6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSnippets.map((snippet) => (
                      <tr key={snippet.id} className="border-b border-gray-100 hover:bg-blue-50/60 transition group cursor-pointer rounded-xl">
                        <td className="py-2 px-2 font-semibold text-gray-900 truncate max-w-[180px]" title={snippet.title}>{snippet.title}</td>
                        <td className="py-2 px-2 text-gray-700 truncate max-w-[320px]" title={snippet.content}>{snippet.content.length > 60 ? snippet.content.slice(0, 60) + '…' : snippet.content}</td>
                        <td className="py-2 px-2 text-gray-700">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-purple-500" />
                            <span className={snippet.folderId === selectedFolderId ? "font-medium text-blue-600" : ""}>
                              {getFolderName(snippet.folderId, folders)}
                            </span>
                            {snippet.folderId === selectedFolderId && (
                              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                                Current
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-gray-500 text-right">{snippet.updatedAt ? new Date(snippet.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "-"}</td>
                        <td className="py-2 px-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" title="Copy" onClick={async (e) => { e.stopPropagation(); await copyToClipboard(snippet.content); toast({ title: "Snippet copied", description: `\"${snippet.title}\" has been copied to clipboard.` }); }} className="h-7 w-7 text-blue-600 hover:text-blue-800 rounded-full transition-all duration-150">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Edit" onClick={() => handleEditSnippet(snippet)} className="h-7 w-7 text-green-600 hover:text-green-800 rounded-full transition-all duration-150">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => handleDeleteSnippet(snippet.id)} className="h-7 w-7 text-red-600 hover:text-red-800 rounded-full transition-all duration-150" disabled={deleteSnippetMutation.isPending}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Move" onClick={() => setMoveSnippetId(snippet.id)} className="h-7 w-7 text-gray-600 hover:text-blue-600 rounded-full transition-all duration-150">
                              <Folder className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <SnippetEditor
        isOpen={snippetEditorOpen}
        onClose={() => {
          setSnippetEditorOpen(false);
          setEditingSnippet(null);
        }}
        editingSnippet={editingSnippet}
        folderId={selectedFolderId}
        onCreate={async (snippet) => {
          await copyToClipboard(snippet.content);
          const folderName = getFolderName(snippet.folderId, folders);
          toast({
            title: "Snippet created and copied",
            description: `"${snippet.title}" has been created in ${folderName} and copied to clipboard.`,
          });
        }}
      />
      <FolderCreationModal
        isOpen={folderCreationModalOpen}
        onClose={() => setFolderCreationModalOpen(false)}
      />
      <FolderRenameModal
        isOpen={folderRenameModalOpen}
        onClose={() => {
          setFolderRenameModalOpen(false);
          setRenamingFolderId(null);
          setRenamingFolderName("");
        }}
        folderId={renamingFolderId}
        currentName={renamingFolderName}
      />
      
      {/* Move Snippet Modal */}
      <Dialog open={moveSnippetId !== null} onOpenChange={() => setMoveSnippetId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-blue-600" />
              Move Snippet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Select Target Folder
              </label>
              <Select
                value={moveTargetFolderId?.toString() || ""}
                onValueChange={(value) => setMoveTargetFolderId(value ? Number(value) : null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a folder..." />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-purple-500" />
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {moveSnippetId && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  Moving: <span className="font-medium text-gray-900">
                    {snippets.find(s => s.id === moveSnippetId)?.title}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMoveSnippetId(null);
                setMoveTargetFolderId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (moveSnippetId && moveTargetFolderId !== null) {
                  moveSnippetMutation.mutate({
                    snippetId: moveSnippetId,
                    folderId: moveTargetFolderId
                  });
                  toast({
                    title: "Snippet moved",
                    description: "The snippet has been moved to the selected folder.",
                  });
                }
              }}
              disabled={moveTargetFolderId === null || moveSnippetMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {moveSnippetMutation.isPending ? "Moving..." : "Move Snippet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
