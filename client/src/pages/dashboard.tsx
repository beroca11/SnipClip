import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, ClipboardList, Keyboard, Settings } from "lucide-react";
import SnippetManager from "@/components/snippet-manager";
import ClipboardHistory from "@/components/clipboard-history";
import SnippetEditor from "@/components/snippet-editor";
import SettingsModal from "@/components/settings-modal";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useClipboardMonitor } from "@/hooks/use-clipboard-monitor";
import type { Snippet, ClipboardItem } from "@shared/schema";

export default function Dashboard() {
  const [snippetModalOpen, setSnippetModalOpen] = useState(false);
  const [clipboardModalOpen, setClipboardModalOpen] = useState(false);
  const [snippetEditorOpen, setSnippetEditorOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  const { data: snippets = [] } = useQuery<Snippet[]>({
    queryKey: ["/api/snippets"],
  });

  const { data: clipboardItems = [] } = useQuery<ClipboardItem[]>({
    queryKey: ["/api/clipboard"],
  });

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onSnippetsOpen: () => setSnippetModalOpen(true),
    onClipboardOpen: () => setClipboardModalOpen(true),
  });

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
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">SnipClip</h1>
                <p className="text-lg text-gray-600 mt-2">The future of productivity is here</p>
                <p className="text-sm text-gray-500 mt-1">We're the most trusted place for managing your snippets and clipboard</p>
              </div>
              <div className="flex gap-4">
                <Button 
                  onClick={() => setSnippetModalOpen(true)}
                  className="flex items-center gap-3 px-6 py-3 text-sm font-medium bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm"
                >
                  <Code className="h-4 w-4" />
                  <span>Snippets</span>
                  <span className="text-xs bg-blue-700 px-2 py-1 rounded-lg">Ctrl+;</span>
                </Button>
                <Button 
                  onClick={() => setClipboardModalOpen(true)}
                  className="flex items-center gap-3 px-6 py-3 text-sm font-medium bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>Clipboard</span>
                  <span className="text-xs bg-blue-700 px-2 py-1 rounded-lg">Ctrl+Shift+V</span>
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

            {/* Keyboard Shortcuts Help */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Keyboard Shortcuts</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Open Snippets</span>
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">Ctrl + ;</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Open Clipboard History</span>
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">Ctrl + Shift + V</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Navigate Results</span>
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">↑ ↓</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Select Item</span>
                  <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">Enter</kbd>
                </div>
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
    </div>
  );
}
