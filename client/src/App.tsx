import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import SnippetsPage from "@/pages/snippets";
import { useState, useEffect } from "react";
import LoginModal from "@/components/login-modal";
import ClipboardHistory from "@/components/clipboard-history";
import SnippetManager from "@/components/snippet-manager";
import SnippetEditor from "@/components/snippet-editor";
import { useClipboardMonitor } from "@/hooks/use-clipboard-monitor";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { Snippet } from "@shared/schema";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/snippets" component={SnippetsPage} />
      <Route component={Dashboard} />
    </Switch>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Overlay state for global access
  const [clipboardModalOpen, setClipboardModalOpen] = useState(false);
  const [snippetModalOpen, setSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const sessionToken = localStorage.getItem("sessionToken");
    const storedUserId = localStorage.getItem("userKey");
    
    if (sessionToken && storedUserId) {
      setIsLoggedIn(true);
      setUserId(storedUserId);
    } else {
      setShowLogin(true);
    }
  }, []);

  // Keyboard shortcut logic for overlays
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      // Clipboard overlay: Ctrl+Alt+Enter
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "enter") {
        e.preventDefault();
        setClipboardModalOpen(true);
      }
      // Snippet overlay: Alt+Enter
      if (!e.ctrlKey && e.altKey && e.key.toLowerCase() === "enter") {
        e.preventDefault();
        setSnippetModalOpen(true);
      }
    };
    const openSnippetListener = () => setSnippetModalOpen(true);
    const openClipboardListener = () => setClipboardModalOpen(true);
    window.addEventListener("keydown", handleGlobalShortcut);
    window.addEventListener("open-snippet-overlay", openSnippetListener);
    window.addEventListener("open-clipboard-overlay", openClipboardListener);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
      window.removeEventListener("open-snippet-overlay", openSnippetListener);
      window.removeEventListener("open-clipboard-overlay", openClipboardListener);
    };
  }, []);

  const handleLoginSuccess = (newUserId: string, sessionToken: string) => {
    setIsLoggedIn(true);
    setUserId(newUserId);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("userKey");
    setIsLoggedIn(false);
    setUserId(null);
    setShowLogin(true);
  };

  // Show login modal if not logged in
  if (!isLoggedIn) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LoginModal isOpen={showLogin} onLoginSuccess={handleLoginSuccess} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50">
          <Router />
          
          {/* Global Overlays */}
          <ClipboardHistory 
            isOpen={clipboardModalOpen} 
            onClose={() => setClipboardModalOpen(false)} 
          />
          
          <SnippetManager 
            isOpen={snippetModalOpen} 
            onClose={() => setSnippetModalOpen(false)}
            onEditSnippet={setEditingSnippet}
            onNewSnippet={() => setEditingSnippet(null)}
          />
          
          <SnippetEditor 
            isOpen={!!editingSnippet} 
            onClose={() => setEditingSnippet(null)}
            editingSnippet={editingSnippet}
          />
          
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// Wrapper components for hooks that need to be inside QueryClientProvider
function ClipboardMonitorWrapper() {
  useClipboardMonitor();
  return null;
}

function KeyboardShortcutsWrapper() {
  useKeyboardShortcuts();
  return null;
}

export default App;
