import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import SnippetsPage from "@/pages/snippets";
import { useState, useEffect } from "react";
import { sha256 } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
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
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [userKey, setUserKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"set" | "enter" | null>(null);
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  // Overlay state for global access
  const [clipboardModalOpen, setClipboardModalOpen] = useState(false);
  const [snippetModalOpen, setSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  useEffect(() => {
    const storedKey = localStorage.getItem("userKey");
    const sessionActive = sessionStorage.getItem("sessionActive");
    if (storedKey && sessionActive === "true") {
      setUserKey(storedKey);
      setMode(null);
    } else if (!storedKey) {
      setMode("set");
    } else {
      setMode("enter");
    }
  }, []);

  // Keyboard shortcut logic for overlays (example: Ctrl+Alt+Enter for clipboard, Alt+Enter for snippets)
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
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, []);

  // Set PIN handler
  const handleSetPin = async () => {
    setError("");
    if (!pin || !pinConfirm) {
      setError("Please enter and confirm your PIN or passphrase.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs do not match.");
      return;
    }
    if (pin.length < 4) {
      setError("PIN/passphrase must be at least 4 characters.");
      return;
    }
    if (!recoveryPhrase || recoveryPhrase.length < 4) {
      setError("Please set a recovery phrase (at least 4 characters).");
      return;
    }
    const hash = await sha256(pin);
    const recoveryHash = await sha256(recoveryPhrase);
    localStorage.setItem("userKey", hash);
    localStorage.setItem("recoveryKey", recoveryHash);
    setUserKey(hash);
    sessionStorage.setItem("sessionActive", "true");
    setMode(null);
  };

  // Enter PIN handler
  const handleEnterPin = async () => {
    setError("");
    const storedKey = localStorage.getItem("userKey");
    if (!pinInput) {
      setError("Please enter your PIN or passphrase.");
      return;
    }
    const hash = await sha256(pinInput);
    if (hash === storedKey) {
      setUserKey(hash);
      sessionStorage.setItem("sessionActive", "true");
      setMode(null);
    } else {
      setError("Incorrect PIN or passphrase.");
    }
  };

  // Recovery handler
  const handleRecovery = async () => {
    setError("");
    const storedRecovery = localStorage.getItem("recoveryKey");
    if (!recoveryInput) {
      setError("Please enter your recovery phrase.");
      return;
    }
    const hash = await sha256(recoveryInput);
    if (hash === storedRecovery) {
      // Allow user to set a new PIN
      setPin("");
      setPinConfirm("");
      setRecoveryInput("");
      setMode("set");
      setShowRecovery(false);
      setError("");
    } else {
      setError("Incorrect recovery phrase.");
    }
  };

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem("sessionActive");
    setUserKey(null);
    setPinInput("");
    setMode("enter");
  };

  return (
    <>
      {/* PIN/Passphrase Modal */}
      <Dialog open={mode !== null || showRecovery}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showRecovery
                ? "Recover Access"
                : mode === "set"
                ? "Set a PIN or Passphrase"
                : "Enter your PIN or Passphrase"}
            </DialogTitle>
          </DialogHeader>
          {showRecovery ? (
            <div className="space-y-3">
              <Input
                type="password"
                placeholder="Enter your recovery phrase"
                value={recoveryInput}
                onChange={e => setRecoveryInput(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleRecovery(); }}
              />
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <DialogFooter>
                <Button onClick={handleRecovery} className="w-full">Recover</Button>
                <Button variant="ghost" onClick={() => { setShowRecovery(false); setError(""); }} className="w-full">Back</Button>
              </DialogFooter>
            </div>
          ) : mode === "set" ? (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  placeholder="Enter PIN or passphrase"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPin(v => !v)}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPinConfirm ? "text" : "password"}
                  placeholder="Confirm PIN or passphrase"
                  value={pinConfirm}
                  onChange={e => setPinConfirm(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPinConfirm(v => !v)}
                  tabIndex={-1}
                >
                  {showPinConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <Input
                type="text"
                placeholder="Set a recovery phrase (at least 4 characters)"
                value={recoveryPhrase}
                onChange={e => setRecoveryPhrase(e.target.value)}
              />
              <div className="text-xs text-gray-500">If you forget your PIN, you can use this phrase to reset it.</div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <DialogFooter>
                <Button onClick={handleSetPin} className="w-full">Set PIN</Button>
              </DialogFooter>
            </div>
          ) : mode === "enter" ? (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type={showPinInput ? "text" : "password"}
                  placeholder="Enter your PIN or passphrase"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleEnterPin(); }}
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPinInput(v => !v)}
                  tabIndex={-1}
                >
                  {showPinInput ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => { setShowRecovery(true); setError(""); }}
                >
                  Forgot PIN?
                </button>
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <DialogFooter>
                <Button onClick={handleEnterPin} className="w-full">Enter</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {/* Global Overlays */}
      {userKey && (
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <ClipboardHistory isOpen={clipboardModalOpen} onClose={() => setClipboardModalOpen(false)} />
            <SnippetManager
              isOpen={snippetModalOpen}
              onClose={() => setSnippetModalOpen(false)}
              onEditSnippet={snippet => setEditingSnippet(snippet)}
              onNewSnippet={() => setEditingSnippet(null)}
            />
            <SnippetEditor
              isOpen={editingSnippet !== null}
              onClose={() => setEditingSnippet(null)}
              editingSnippet={editingSnippet}
            />
            <Router />
            <button onClick={handleLogout} style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000 }} className="text-xs bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">Logout</button>
            <ClipboardMonitorWrapper />
            <KeyboardShortcutsWrapper />
          </TooltipProvider>
        </QueryClientProvider>
      )}
    </>
  );
}

// Wrapper component to use the clipboard monitor hook
function ClipboardMonitorWrapper() {
  useClipboardMonitor();
  return null;
}

// Wrapper component to use the keyboard shortcuts hook
function KeyboardShortcutsWrapper() {
  useKeyboardShortcuts();
  return null;
}

export default App;
