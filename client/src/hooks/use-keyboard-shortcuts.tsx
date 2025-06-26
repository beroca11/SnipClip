import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { type Snippet } from '@shared/schema';

export function useKeyboardShortcuts() {
  const { toast } = useToast();

  // Fetch snippets to get their shortcuts
  const { data: snippets = [] } = useQuery<Snippet[]>({
    queryKey: ['/api/snippets'],
  });

  // Function to copy text to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Snippet Copied",
        description: "Snippet content copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: "Error",
        description: "Failed to copy snippet to clipboard",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Function to find snippet by shortcut
  const findSnippetByShortcut = useCallback((shortcut: string) => {
    return snippets.find(snippet => {
      if (!snippet.trigger) return false;
      
      // Extract shortcut from trigger (format: "shortcut-timestamp")
      const triggerParts = snippet.trigger.split('-');
      if (triggerParts.length < 2) return false;
      
      const snippetShortcut = triggerParts[0];
      return snippetShortcut === shortcut;
    });
  }, [snippets]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const keys: string[] = [];
    
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.metaKey) keys.push('Cmd');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    
    // Add the main key
    if (event.key !== 'Control' && event.key !== 'Meta' && event.key !== 'Alt' && event.key !== 'Shift') {
      keys.push(event.key.toUpperCase());
    }
    
    if (keys.length > 1) {
      const shortcutString = keys.join('+');
      const snippet = findSnippetByShortcut(shortcutString);
      
      if (snippet) {
        event.preventDefault();
        event.stopPropagation();
        copyToClipboard(snippet.content);
      }
    }
  }, [findSnippetByShortcut, copyToClipboard]);

  // Set up global keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    snippets,
    findSnippetByShortcut,
    copyToClipboard,
  };
}
