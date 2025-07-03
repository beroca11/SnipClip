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
import type { Snippet } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Helper: Build a nested folder tree from flat folder list
function buildFolderTree(folders: { id: number|null, name: string, parentId?: number|null }[]): { id: number|null, name: string, parentId?: number|null, children: any[] }[] {
  const map: Record<string, { id: number|null, name: string, parentId?: number|null, children: any[] }> = {};
  const roots: { id: number|null, name: string, parentId?: number|null, children: any[] }[] = [];
  folders.forEach((folder) => {
    map[String(folder.id)] = { ...folder, children: [] };
  });
  folders.forEach((folder) => {
    if (folder.parentId) {
      if (map[String(folder.parentId)]) map[String(folder.parentId)].children.push(map[String(folder.id)]);
    } else {
      roots.push(map[String(folder.id)]);
    }
  });
  return roots;
}

// Helper: Render the folder tree recursively
function FolderTree({ nodes, selectedId, onSelect, onRename, onDelete, onCreateSubfolder }:{ nodes: { id: number|null, name: string, parentId?: number|null, children: any[] }[], selectedId: number|null, onSelect: (id: number|null) => void, onRename: (id: number|null, name: string) => void, onDelete: (id: number|null) => void, onCreateSubfolder: (parentId: number|null) => void }) {
  return (
    <ul className="pl-2">
      {nodes.map(node => (
        <li key={node.id ?? 'general'} className="mb-1">
          <div className={`flex items-center gap-1 cursor-pointer rounded px-2 py-1 ${selectedId === node.id ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-gray-700'}`}
               onClick={() => onSelect(node.id)}>
            <Folder className="h-4 w-4 mr-1 text-purple-500" />
            <span className="truncate flex-1">{node.name}</span>
            <Button size="icon" variant="ghost" className="text-xs text-blue-600 hover:text-blue-800" onClick={e => { e.stopPropagation(); onCreateSubfolder(node.id); }}>
              <FolderPlus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-blue-600" onClick={e => { e.stopPropagation(); onRename(node.id, node.name); }}><Edit className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="text-red-600" onClick={e => { e.stopPropagation(); if (window.confirm("Delete this folder and all its snippets?")) onDelete(node.id); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
          {node.children && node.children.length > 0 && (
            <FolderTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} onRename={onRename} onDelete={onDelete} onCreateSubfolder={onCreateSubfolder} />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function SnippetsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [snippetEditorOpen, setSnippetEditorOpen] = useState(false);
  const [folderCreationModalOpen, setFolderCreationModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
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
  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PUT", `/api/folders/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setRenamingFolderId(null);
      setRenameValue("");
    },
  });
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
  const folderTree = buildFolderTree(folders);

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

  const handleCreateFolderWithParent = (parentId: number|null) => {
    setSelectedFolderId(parentId !== null ? parentId : null);
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
    if (typeof id === 'number') deleteFolderMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Lato, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <div className="p-8 max-w-7xl mx-auto flex flex-row gap-8 items-start">
        {/* Left Sidebar: Folder Tree */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-md p-4 sticky top-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Lato, system-ui, sans-serif' }}>Folders</h2>
              <Button size="icon" variant="ghost" onClick={() => handleCreateFolderWithParent(null)} className="text-blue-600 hover:text-blue-800">
                <FolderPlus className="h-5 w-5" />
              </Button>
            </div>
            <FolderTree
              nodes={folderTree}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onRename={(id, name) => { setRenamingFolderId(id); setRenameValue(name); }}
              onDelete={handleDeleteFolder}
              onCreateSubfolder={handleCreateFolderWithParent}
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
                    <p className="text-2xl font-extrabold text-gray-900">{folders.length - 1}</p>
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
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? "No snippets found" : "No snippets yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm ? "Try adjusting your search" : "Create your first snippet to get started"}
                </p>
                <Button onClick={handleNewSnippet} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Snippet
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="w-full">
              <div className="grid grid-cols-12 gap-2 px-2 py-2 border-b border-gray-300 bg-gray-100 sticky top-0 z-10 rounded-t-xl text-[14px] font-semibold" style={{ fontFamily: 'Lato, system-ui, sans-serif', fontSize: 14 }}>
                <div className="col-span-3">Name</div>
                <div className="col-span-5">Content</div>
                <div className="col-span-2 text-right">Date Modified</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div>
                {filteredSnippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="grid grid-cols-12 gap-2 items-center px-2 py-2 border-b border-gray-200 hover:bg-blue-100/60 transition-all text-[13px] font-normal cursor-pointer group"
                    style={{ fontFamily: 'Lato, system-ui, sans-serif', fontSize: 13 }}
                    onClick={async () => {
                      await copyToClipboard(snippet.content);
                      toast({
                        title: "Snippet copied",
                        description: `\"${snippet.title}\" has been copied to clipboard.`,
                      });
                    }}
                  >
                    <div className="col-span-3 font-semibold text-gray-900 truncate">{snippet.title}</div>
                    <div className="col-span-5 text-gray-700 truncate" title={snippet.content} style={{maxWidth: '100%'}}>
                      {snippet.content.length > 60 ? snippet.content.slice(0, 60) + '…' : snippet.content}
                    </div>
                    <div className="col-span-2 text-gray-500 text-right">
                      {snippet.updatedAt ? new Date(snippet.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "-"}
                    </div>
                    <div className="col-span-2 flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={async (e) => { e.stopPropagation(); await copyToClipboard(snippet.content); toast({ title: "Snippet copied", description: `\"${snippet.title}\" has been copied to clipboard.` }); }} className="h-7 w-7 text-blue-600 hover:text-blue-800">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleEditSnippet(snippet)} className="h-7 w-7 text-green-600 hover:text-green-800">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteSnippet(snippet.id)} className="h-7 w-7 text-red-600 hover:text-red-800" disabled={deleteSnippetMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setMoveSnippetId(snippet.id)} className="h-7 w-7 text-gray-600 hover:text-blue-600">
                        <Folder className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
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
        onCreate={async (snippet) => {
          await copyToClipboard(snippet.content);
          toast({
            title: "Snippet copied",
            description: `"${snippet.title}" has been copied to clipboard.`,
          });
        }}
        folderId={selectedFolderId}
      />

      <FolderCreationModal
        isOpen={folderCreationModalOpen}
        onClose={() => setFolderCreationModalOpen(false)}
        parentFolder={selectedFolderId !== null ? String(selectedFolderId) : null}
      />

      {/* Move Snippet Modal */}
      <Dialog open={!!moveSnippetId} onOpenChange={open => { if (!open) { setMoveSnippetId(null); setMoveTargetFolderId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Snippet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm font-medium">Select target folder:</label>
            <select
              className="w-full rounded border px-2 py-1"
              value={moveTargetFolderId ?? ""}
              onChange={e => setMoveTargetFolderId(e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="" disabled>Select folder</option>
              {folderTree.map(folder => (
                <option key={folder.id ?? 'general'} value={folder.id ?? ""}>{folder.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setMoveSnippetId(null); setMoveTargetFolderId(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (moveSnippetId && moveTargetFolderId) {
                  moveSnippetMutation.mutate({ snippetId: moveSnippetId, folderId: moveTargetFolderId });
                }
              }}
              disabled={!moveTargetFolderId || moveSnippetMutation.isPending}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 