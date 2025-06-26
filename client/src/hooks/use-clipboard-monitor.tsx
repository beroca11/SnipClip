import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Settings } from "@shared/schema";

export function useClipboardMonitor() {
  const lastClipboardContent = useRef<string>("");
  const lastAddedContent = useRef<string>("");
  const isUserCopying = useRef<boolean>(false);
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  // Initialize lastClipboardContent from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("lastClipboardContent");
    if (stored) lastClipboardContent.current = stored;
  }, []);

  const addClipboardItemMutation = useMutation({
    mutationFn: (data: { content: string; type: string }) =>
      apiRequest("POST", "/api/clipboard", data),
    onSuccess: (_, variables) => {
      // Store the content that was just added to prevent immediate re-addition
      lastAddedContent.current = variables.content;
      lastClipboardContent.current = variables.content;
      sessionStorage.setItem("lastClipboardContent", variables.content);
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
        
        // Don't add if it's the same as last clipboard content, empty, was just added, or user is actively copying
        if (text && 
            text !== lastClipboardContent.current && 
            text !== lastAddedContent.current &&
            text.trim().length > 0 &&
            !isUserCopying.current) {
          lastClipboardContent.current = text;
          sessionStorage.setItem("lastClipboardContent", text);
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

  // Listen for copy events to capture clipboard changes more reliably
  useEffect(() => {
    if (!settings?.clipboardEnabled) return;

    const handleCopy = () => {
      // Mark that user is actively copying
      isUserCopying.current = true;
      
      // Small delay to ensure clipboard is updated before we read it
      setTimeout(async () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.readText) {
            return;
          }

          const text = await navigator.clipboard.readText();
          
          // Don't add if it's the same as last clipboard content, empty, was just added
          if (text && 
              text !== lastClipboardContent.current && 
              text !== lastAddedContent.current &&
              text.trim().length > 0) {
            lastClipboardContent.current = text;
            sessionStorage.setItem("lastClipboardContent", text);
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
        } finally {
          // Reset the flag after a short delay
          setTimeout(() => {
            isUserCopying.current = false;
          }, 500);
        }
      }, 100);
    };

    document.addEventListener("copy", handleCopy);
    return () => document.removeEventListener("copy", handleCopy);
  }, [settings?.clipboardEnabled]);

  // Clear the lastAddedContent after a delay to allow normal clipboard monitoring to resume
  useEffect(() => {
    if (lastAddedContent.current) {
      const timer = setTimeout(() => {
        lastAddedContent.current = "";
      }, 3000); // Wait 3 seconds before allowing the same content to be added again
      
      return () => clearTimeout(timer);
    }
  }, [lastAddedContent.current]);
}
