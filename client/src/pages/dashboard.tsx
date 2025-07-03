import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Code, ClipboardList, Keyboard, Settings as SettingsIcon, TrendingUp, Clock, Zap, FolderOpen, LogOut } from "lucide-react";
import SnippetManager from "@/components/snippet-manager";
import ClipboardHistory from "@/components/clipboard-history";
import SnippetEditor from "@/components/snippet-editor";
import SettingsModal from "@/components/settings-modal";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useClipboardMonitor } from "@/hooks/use-clipboard-monitor";
import { apiRequest } from "@/lib/queryClient";
import type { Snippet, ClipboardItem, Settings } from "@shared/schema";
import { Link } from "wouter";

export default function Dashboard() {
  const dashboardInstance = Math.random().toString(36).slice(2, 8);
  console.log('Dashboard rendered', dashboardInstance);
  const [snippetEditorOpen, setSnippetEditorOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

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



  // Initialize new snippet keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize clipboard monitoring
  useClipboardMonitor();

  const handleEditSnippet = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setSnippetEditorOpen(true);
  };

  const handleNewSnippet = () => {
    setEditingSnippet(null);
    setSnippetEditorOpen(true);
  };



  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("userKey");
    
    // Reload the page to trigger the login flow
    window.location.reload();
  };

  const getRecentActivity = () => {
    const recentSnippets = snippets.slice(0, 2).map(snippet => ({
      type: 'snippet' as const,
      title: snippet.title,
      description: 'Code snippet',
      time: new Date(snippet.updatedAt),
      icon: Code,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    }));

    const recentClipboard = clipboardItems.slice(0, 2).map(item => ({
      type: 'clipboard' as const,
      title: item.content.length > 50 ? item.content.substring(0, 50) + '...' : item.content,
      description: 'From clipboard history',
      time: new Date(item.createdAt),
      icon: ClipboardList,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    }));

    return [...recentSnippets, ...recentClipboard]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 4);
  };

  const recentActivity = getRecentActivity();

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const openGlobalSnippetOverlay = () => {
    window.dispatchEvent(new CustomEvent('open-snippet-overlay'));
  };

  const openGlobalClipboardOverlay = () => {
    window.dispatchEvent(new CustomEvent('open-clipboard-overlay'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Code className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  SnipClip
                </h1>
                <p className="text-sm text-slate-500">Productivity Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setSettingsModalOpen(true)}
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <SettingsIcon className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Welcome to your
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> productivity hub</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Streamline your workflow with intelligent snippet management and clipboard history. 
            Everything you need to code faster and work smarter.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/70 backdrop-blur-sm hover:bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Code className="w-6 h-6 text-white" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  {settings?.snippetShortcut || "alt+enter"}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Quick Snippets</h3>
              <p className="text-slate-600 text-sm mb-4">Access your code snippets instantly with keyboard shortcuts</p>
              <Button 
                onClick={openGlobalSnippetOverlay}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
              >
                Open Snippets
              </Button>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/70 backdrop-blur-sm hover:bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-6 h-6 text-white" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  {settings?.clipboardShortcut || "ctrl+alt+enter"}
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Clipboard History</h3>
              <p className="text-slate-600 text-sm mb-4">Never lose important copied content with smart history</p>
              <Button 
                onClick={openGlobalClipboardOverlay}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white border-0"
              >
                View History
              </Button>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/70 backdrop-blur-sm hover:bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FolderOpen className="w-6 h-6 text-white" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  Manage
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Snippet Manager</h3>
              <p className="text-slate-600 text-sm mb-4">Organize and manage all your code snippets efficiently</p>
              <Link href="/snippets">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white border-0">
                  Manage Snippets
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/70 backdrop-blur-sm hover:bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  Pro Tips
                </Badge>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Keyboard Shortcuts</h3>
              <p className="text-slate-600 text-sm mb-4">Master productivity with custom keyboard shortcuts</p>
              <Button 
                onClick={() => setSettingsModalOpen(true)}
                variant="outline"
                className="w-full border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-slate-700"
              >
                Configure
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-0 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total Snippets</p>
                  <p className="text-3xl font-bold text-slate-900">{snippets.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Ready to use</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
                  <Code className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Clipboard Items</p>
                  <p className="text-3xl font-bold text-slate-900">{clipboardItems.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Recently copied</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center">
                  <ClipboardList className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Productivity Score</p>
                  <p className="text-3xl font-bold text-slate-900">{Math.min(100, Math.max(0, snippets.length * 10 + clipboardItems.length * 5))}</p>
                  <p className="text-xs text-slate-500 mt-1">Based on usage</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-0 bg-white/70 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Recent Activity</h3>
                  <p className="text-sm text-slate-500">Your latest snippets and clipboard items</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 ${activity.bgColor} rounded-xl flex items-center justify-center`}>
                        <activity.icon className={`${activity.color} h-5 w-5`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                        <p className="text-xs text-slate-500">{activity.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                        {formatTimeAgo(activity.time)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Code className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 mb-2">No recent activity</h4>
                  <p className="text-slate-500 mb-6">Create your first snippet or copy something to get started!</p>
                  <div className="flex items-center justify-center space-x-3">
                    <Button 
                      onClick={handleNewSnippet}
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
                    >
                      Create Snippet
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    >
                      Learn More
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <SnippetManager
        isOpen={false}
        onClose={() => {}}
        onEditSnippet={handleEditSnippet}
        onNewSnippet={handleNewSnippet}
      />

      <ClipboardHistory
        isOpen={false}
        onClose={() => {}}
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
