import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, ClipboardList, Keyboard, Settings as SettingsIcon } from "lucide-react";
import SnippetManager from "@/components/snippet-manager";
import ClipboardHistory from "@/components/clipboard-history";
import SnippetEditor from "@/components/snippet-editor";
import SettingsModal from "@/components/settings-modal";
import FolderCreationModal from "@/components/folder-creation-modal";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useClipboardMonitor } from "@/hooks/use-clipboard-monitor";
import type { Snippet, ClipboardItem, Settings } from "@shared/schema";
import { Link } from "wouter";

// Legacy keyboard shortcuts hook for opening overlays
function useLegacyKeyboardShortcuts({ onSnippetsOpen, onClipboardOpen }: {
  onSnippetsOpen: () => void;
  onClipboardOpen: () => void;
}) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    refetchInterval: 1000, // Refetch every second to get real-time updates
  });

  useEffect(() => {
    const parseShortcut = (shortcut: string) => {
      if (!shortcut) return { modifiers: [], key: "" };
      
      const parts = shortcut.toLowerCase().split('+');
      const modifiers = parts.slice(0, -1);
      const key = parts[parts.length - 1];
      return { modifiers, key };
    };

    const checkShortcut = (e: KeyboardEvent, shortcut: string) => {
      if (!shortcut) return false;
      
      const { modifiers, key } = parseShortcut(shortcut);
      
      const pressedModifiers: string[] = [];
      if (e.ctrlKey || e.metaKey) pressedModifiers.push('ctrl');
      if (e.altKey) pressedModifiers.push('alt');
      if (e.shiftKey) pressedModifiers.push('shift');
      
      const pressedKey = e.key.toLowerCase();
      
      return (
        modifiers.length === pressedModifiers.length &&
        modifiers.every(mod => pressedModifiers.includes(mod)) &&
        key === pressedKey
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!settings) return;

      // Check snippet shortcut
      if (checkShortcut(e, settings.snippetShortcut)) {
        e.preventDefault();
        onSnippetsOpen();
      }
      
      // Check clipboard shortcut
      if (checkShortcut(e, settings.clipboardShortcut)) {
        e.preventDefault();
        onClipboardOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSnippetsOpen, onClipboardOpen, settings]);
}

export default function Dashboard() {
  const [snippetModalOpen, setSnippetModalOpen] = useState(false);
  const [clipboardModalOpen, setClipboardModalOpen] = useState(false);
  const [snippetEditorOpen, setSnippetEditorOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [folderCreationModalOpen, setFolderCreationModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  const { data: snippets = [] } = useQuery<Snippet[]>({
    queryKey: ["/api/snippets"],
  });

  const { data: clipboardItems = [] } = useQuery<ClipboardItem[]>({
    queryKey: ["/api/clipboard"],
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Initialize legacy keyboard shortcuts for opening overlays
  useLegacyKeyboardShortcuts({
    onSnippetsOpen: () => setSnippetModalOpen(true),
    onClipboardOpen: () => setClipboardModalOpen(true),
  });

  // Initialize new snippet keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize clipboard monitoring
  useClipboardMonitor();

  const handleEditSnippet = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setSnippetEditorOpen(true);
    setSnippetModalOpen(false);
  };

  const handleNewSnippet = () => {
    setEditingSnippet(null);
    setSnippetEditorOpen(true);
    setSnippetModalOpen(false);
  };

  const handleCreateFolder = () => {
    setFolderCreationModalOpen(true);
    setSnippetModalOpen(false);
  };

  const getRecentActivity = () => {
    const recentSnippets = snippets.slice(0, 2).map(snippet => ({
      type: 'snippet' as const,
      title: snippet.title,
      description: 'Code snippet',
      time: new Date(snippet.updatedAt),
      icon: Code,
      color: 'text-blue-600',
    }));

    const recentClipboard = clipboardItems.slice(0, 2).map(item => ({
      type: 'clipboard' as const,
      title: item.content.length > 50 ? item.content.substring(0, 50) + '...' : item.content,
      description: 'From clipboard history',
      time: new Date(item.createdAt),
      icon: ClipboardList,
      color: 'text-emerald-600',
    }));

    return [...recentSnippets, ...recentClipboard]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 4);
  };

  const recentActivity = getRecentActivity();

  return (
    <div className="min-h-screen bg-white">
      <div className="p-8 max-w-5xl mx-auto">
        <Card className="mb-8 border-0 shadow-lg rounded-xl">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6 md:gap-0">
              {/* Left: Title, subtitle, description */}
              <div className="flex flex-col items-start max-w-xs md:max-w-sm">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">SnipClip</h1>
                <p className="text-lg text-gray-700 mb-1">The future of productivity is here</p>
                <p className="text-sm text-gray-400 leading-snug">We're the most trusted place for managing your snippets and clipboard</p>
              </div>
              {/* Right: Button group */}
              <div className="flex flex-wrap gap-4 md:gap-6 items-center justify-center">
                <Button 
                  onClick={() => setSnippetModalOpen(true)}
                  className="flex items-center gap-2 px-7 py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  style={{ minWidth: 140 }}
                >
                  <Code className="h-5 w-5" />
                  <span>Snippets</span>
                  <span className="ml-2 px-2 py-0.5 rounded bg-blue-800 text-xs font-mono font-medium">{settings?.snippetShortcut || "alt+enter"}</span>
                </Button>
                <Link href="/snippets">
                  <Button 
                    className="flex items-center gap-2 px-7 py-3 text-base font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all border-2 border-gray-900"
                    style={{ minWidth: 170 }}
                  >
                    <Code className="h-5 w-5" />
                    <span>Manage Snippets</span>
                  </Button>
                </Link>
                <Button 
                  onClick={() => setClipboardModalOpen(true)}
                  className="flex items-center gap-2 px-7 py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  style={{ minWidth: 140 }}
                >
                  <ClipboardList className="h-5 w-5" />
                  <span>Clipboard</span>
                  <span className="ml-2 px-2 py-0.5 rounded bg-blue-800 text-xs font-mono font-medium">{settings?.clipboardShortcut || "ctrl+alt+enter"}</span>
                </Button>
                <Button 
                  onClick={() => setSettingsModalOpen(true)}
                  className="flex items-center gap-2 px-7 py-3 text-base font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                  style={{ minWidth: 120 }}
                >
                  <SettingsIcon className="h-5 w-5" />
                  <span>Settings</span>
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-50 rounded-xl mr-4">
                    <Code className="text-primary h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total Snippets</p>
                    <p className="text-3xl font-bold text-gray-900">{snippets.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-50 rounded-xl mr-4">
                    <ClipboardList className="text-primary h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Clipboard Items</p>
                    <p className="text-3xl font-bold text-gray-900">{clipboardItems.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-50 rounded-xl mr-4">
                    <Keyboard className="text-primary h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Active Shortcuts</p>
                    <p className="text-3xl font-bold text-gray-900">{snippets.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <activity.icon className={`${activity.color} h-4 w-4 mr-3`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                          <p className="text-xs text-gray-500">{activity.description}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round((Date.now() - activity.time.getTime()) / 60000)} min ago
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent activity</p>
                    <p className="text-sm">Create a snippet or copy something to get started!</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <SnippetManager
        isOpen={snippetModalOpen}
        onClose={() => setSnippetModalOpen(false)}
        onEditSnippet={handleEditSnippet}
        onNewSnippet={handleNewSnippet}
      />

      <ClipboardHistory
        isOpen={clipboardModalOpen}
        onClose={() => setClipboardModalOpen(false)}
      />

      <SnippetEditor
        isOpen={snippetEditorOpen}
        onClose={() => {
          setSnippetEditorOpen(false);
          setEditingSnippet(null);
        }}
        editingSnippet={editingSnippet}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

      <FolderCreationModal
        isOpen={folderCreationModalOpen}
        onClose={() => setFolderCreationModalOpen(false)}
      />
    </div>
  );
}
