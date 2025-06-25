import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";

export function useClipboardMonitor() {
  const lastClipboardContent = useRef<string>("");
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const addClipboardItemMutation = useMutation({
    mutationFn: (data: { content: string; type: string }) =>
      apiRequest("POST", "/api/clipboard", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clipboard"] });
    },
  });

  useEffect(() => {
    if (!settings?.clipboardEnabled) return;

    const checkClipboard = async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          return; // Clipboard API not available
        }

        const text = await navigator.clipboard.readText();
        
        if (text && text !== lastClipboardContent.current && text.trim().length > 0) {
          lastClipboardContent.current = text;
          
          // Determine content type
          let type = "text";
          if (text.match(/^https?:\/\//)) {
            type = "url";
          } else if (
            text.includes("function") || 
            text.includes("const") || 
            text.includes("=>") || 
            text.includes("class") ||
            text.includes("{") ||
            text.includes("}")
          ) {
            type = "code";
          }

          addClipboardItemMutation.mutate({ content: text, type });
        }
      } catch (error) {
        // Clipboard access denied or not available
        // This is expected in many scenarios, so we silently ignore
      }
    };

    // Check clipboard every 2 seconds
    const interval = setInterval(checkClipboard, 2000);
    
    // Initial check
    checkClipboard();

    return () => clearInterval(interval);
  }, [settings?.clipboardEnabled]);

  // Also listen for copy events to capture clipboard changes more reliably
  useEffect(() => {
    if (!settings?.clipboardEnabled) return;

    const handleCopy = () => {
      // Small delay to ensure clipboard is updated before we read it
      setTimeout(async () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.readText) {
            return;
          }

          const text = await navigator.clipboard.readText();
          
          if (text && text !== lastClipboardContent.current && text.trim().length > 0) {
            lastClipboardContent.current = text;
            
            let type = "text";
            if (text.match(/^https?:\/\//)) {
              type = "url";
            } else if (
              text.includes("function") || 
              text.includes("const") || 
              text.includes("=>") || 
              text.includes("class") ||
              text.includes("{") ||
              text.includes("}")
            ) {
              type = "code";
            }

            addClipboardItemMutation.mutate({ content: text, type });
          }
        } catch (error) {
          // Clipboard access denied
        }
      }, 100);
    };

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, [settings?.clipboardEnabled]);
}
