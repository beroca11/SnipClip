import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, X, Keyboard, ChevronUp, ChevronDown, Folder } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSnippetSchema, type Snippet, type InsertSnippet } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface SnippetEditorProps {
  isOpen: boolean;
  onClose: () => void;
  editingSnippet?: Snippet | null;
  onCreate?: (snippet: Snippet) => void;
  folderId?: number | null;
}

export default function SnippetEditor({ isOpen, onClose, editingSnippet, onCreate, folderId }: SnippetEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [shortcut, setShortcut] = useState("");
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const formContentRef = useRef<HTMLDivElement>(null);

  // Fetch folders for dropdown
  const { data: folders = [] } = useQuery<any[]>({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      return res.json();
    },
  });

  const form = useForm<InsertSnippet>({
    resolver: zodResolver(insertSnippetSchema),
    defaultValues: {
      title: "",
      content: "",
      trigger: "",
      description: "",
      folderId: folderId ?? null,
    },
    mode: "onChange",
  });

  // Reset form when opening/closing or editing different snippet
  useEffect(() => {
    if (isOpen) {
      if (editingSnippet) {
        form.reset({
          title: editingSnippet.title,
          content: editingSnippet.content,
          trigger: editingSnippet.trigger,
          description: editingSnippet.description || "",
          folderId: editingSnippet.folderId ?? folderId ?? null,
        });
        // Extract shortcut from trigger if it exists
        const triggerParts = editingSnippet.trigger?.split('-') || [];
        if (triggerParts.length > 1) {
          setShortcut(triggerParts[0]);
        }
      } else {
        form.reset({
          title: "",
          content: "",
          trigger: "",
          description: "",
          folderId: folderId ?? null,
        });
        setShortcut("");
      }
    }
  }, [isOpen, editingSnippet, form, folderId]);

  // Handle keyboard shortcut recording
  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecordingShortcut) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const keys: string[] = [];
    
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.metaKey) keys.push('Cmd');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    
    // Add the main key
    if (e.key !== 'Control' && e.key !== 'Meta' && e.key !== 'Alt' && e.key !== 'Shift') {
      keys.push(e.key.toUpperCase());
    }
    
    if (keys.length > 1) {
      const shortcutString = keys.join('+');
      setShortcut(shortcutString);
      setIsRecordingShortcut(false);
      
      // Update the trigger field with the shortcut
      form.setValue('trigger', `${shortcutString}-${Date.now()}`);
    }
  };

  // Listen for keyboard events when recording
  useEffect(() => {
    if (isRecordingShortcut) {
      document.addEventListener('keydown', handleShortcutKeyDown as any);
      return () => {
        document.removeEventListener('keydown', handleShortcutKeyDown as any);
      };
    }
  }, [isRecordingShortcut]);

  const startRecordingShortcut = () => {
    setIsRecordingShortcut(true);
    setShortcut("Press keys...");
    setTimeout(() => shortcutInputRef.current?.focus(), 100);
  };

  const stopRecordingShortcut = () => {
    setIsRecordingShortcut(false);
    if (shortcut === "Press keys...") {
      setShortcut("");
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: InsertSnippet) => {
      // Ensure trigger is unique
      const timestamp = Date.now();
      const uniqueTrigger = data.trigger ? `${data.trigger}-${timestamp}` : `snippet-${timestamp}`;
      const response = await apiRequest("POST", "/api/snippets", {
        ...data,
        trigger: uniqueTrigger,
        folderId: data.folderId ?? folderId ?? null,
      });
      
      // Parse the response
      const result = await response.json();
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({
        title: "Success",
        description: "Snippet created successfully",
      });
      if (onCreate) onCreate(result);
      onClose();
    },
    onError: (error: Error) => {
      console.error("Create snippet error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create snippet",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertSnippet) => {
      const response = await apiRequest("PUT", `/api/snippets/${editingSnippet!.id}`, {
        ...data,
        folderId: data.folderId ?? folderId ?? null,
      });
      
      // Parse the response
      const result = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({
        title: "Success",
        description: "Snippet updated successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Update snippet error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update snippet",
        variant: "destructive",
      });
    },
  });

  const handleManualSave = async () => {
    const formData = form.getValues();
    console.log("Manual save triggered with data:", formData);
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingSnippet) {
        console.log("Manual update snippet:", editingSnippet.id);
        await updateMutation.mutateAsync(formData);
      } else {
        console.log("Manual create new snippet");
        await createMutation.mutateAsync(formData);
      }
    } catch (error) {
      console.error("Manual snippet submission error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: InsertSnippet) => {
    console.log("Submitting snippet data:", data);
    console.log("Form is valid:", form.formState.isValid);
    console.log("Form errors:", form.formState.errors);
    
    if (!data.title.trim() || !data.content.trim()) {
      toast({
        title: "Validation Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingSnippet) {
        console.log("Updating snippet:", editingSnippet.id);
        await updateMutation.mutateAsync(data);
      } else {
        console.log("Creating new snippet");
        await createMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Snippet submission error:", error);
      // Error handling is done in the mutation onError callbacks
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setShortcut("");
    setIsRecordingShortcut(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (isRecordingShortcut) {
        stopRecordingShortcut();
      } else {
        handleClose();
      }
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Ctrl/Cmd + Enter pressed, submitting form");
      form.handleSubmit(onSubmit)();
    } else if (e.key === "PageUp") {
      e.preventDefault();
      handleScrollUp();
    } else if (e.key === "PageDown") {
      e.preventDefault();
      handleScrollDown();
    }
  };

  const handleScrollUp = () => {
    if (formContentRef.current) {
      formContentRef.current.scrollBy({
        top: -300,
        behavior: 'smooth'
      });
    }
  };

  const handleScrollDown = () => {
    if (formContentRef.current) {
      formContentRef.current.scrollBy({
        top: 300,
        behavior: 'smooth'
      });
    }
  };

  // Debug form state
  useEffect(() => {
    const subscription = form.watch((value) => {
      console.log("Form values changed:", value);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop">
      <div
        className="overlay-content-dark max-w-2xl mx-4"
        style={{ minHeight: 500 }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-blue-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <Plus className="h-5 w-5 text-blue-400" />
            </div>
            <h2 
              className="text-[18px] font-semibold text-white"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >
              {editingSnippet ? "Edit Snippet" : "Create New Snippet"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScrollUp}
              className="h-8 w-8 p-0 rounded-lg hover:bg-blue-800/40 text-blue-300 hover:text-white transition-all duration-150"
              title="Scroll Up (Page Up)"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScrollDown}
              className="h-8 w-8 p-0 rounded-lg hover:bg-blue-800/40 text-blue-300 hover:text-white transition-all duration-150"
              title="Scroll Down (Page Down)"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 rounded-lg hover:bg-blue-800/40 text-blue-300 hover:text-white transition-all duration-150"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Form Content */}
        <div 
          ref={formContentRef}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        className="text-[13px] font-medium text-blue-200"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                      >
                        Title *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter snippet title" 
                          className="rounded-xl text-[14px] border-0 bg-blue-900/50 text-white placeholder:text-blue-300/60 focus:ring-2 focus:ring-blue-400 focus:outline-none border border-blue-700/30"
                          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trigger"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        className="text-[13px] font-medium text-blue-200"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                      >
                        Trigger
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., useeffect, cl, arrow" 
                          className="rounded-xl font-mono text-[14px] border-0 bg-blue-900/50 text-white placeholder:text-blue-300/60 focus:ring-2 focus:ring-blue-400 focus:outline-none border border-blue-700/30"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="folderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        className="text-[13px] font-medium text-blue-200"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                      >
                        Folder
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value?.toString() || ""}
                          onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                        >
                          <SelectTrigger className="rounded-xl text-[14px] border-0 bg-blue-900/50 text-white focus:ring-2 focus:ring-blue-400 focus:outline-none border border-blue-700/30">
                            <SelectValue placeholder="Select folder..." />
                          </SelectTrigger>
                          <SelectContent>
                            {folders.map((folder) => (
                              <SelectItem key={folder.id} value={folder.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 rounded bg-purple-500/20 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded bg-purple-500"></div>
                                  </div>
                                  {folder.name}
                                  {folder.name === "General" && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                                      Default
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                      {field.value && (
                        <p className="text-[11px] text-blue-300/70 mt-1">
                          Snippet will be created in: <span className="font-medium text-blue-200">
                            {folders.find(f => f.id === field.value)?.name || 'Unknown folder'}
                          </span>
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel 
                    className="text-[13px] font-medium text-blue-200"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                  >
                    Keyboard Shortcut
                  </FormLabel>
                  <div className="flex gap-2">
                    <Input
                      ref={shortcutInputRef}
                      placeholder="Click to record shortcut"
                      value={shortcut}
                      readOnly
                      className="rounded-xl text-[14px] border-0 bg-blue-900/50 text-white placeholder:text-blue-300/60 focus:ring-2 focus:ring-blue-400 focus:outline-none font-mono border border-blue-700/30"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    />
                    <Button
                      type="button"
                      variant={isRecordingShortcut ? "destructive" : "outline"}
                      onClick={isRecordingShortcut ? stopRecordingShortcut : startRecordingShortcut}
                      className="px-4 rounded-xl border-blue-600 text-blue-300 hover:text-white hover:bg-blue-700/40 transition-all duration-150"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    >
                      <Keyboard className="h-4 w-4 mr-2" />
                      {isRecordingShortcut ? "Stop" : "Record"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-blue-300/70 mt-1">
                    Press the keys you want to use as a shortcut (e.g., Ctrl+Shift+S)
                  </p>
                </FormItem>
              </div>

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel 
                      className="text-[13px] font-medium text-blue-200"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    >
                      Content *
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your snippet content here..."
                        className="min-h-[200px] rounded-xl font-mono text-[14px] resize-none border-0 bg-blue-900/50 text-white placeholder:text-blue-300/60 focus:ring-2 focus:ring-blue-400 focus:outline-none border border-blue-700/30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Hidden submit button for keyboard shortcuts */}
              <button type="submit" style={{ display: 'none' }} />
            </form>
          </Form>
        </div>
        {/* Sticky Footer for Actions */}
        <div className="sticky-footer-actions px-6 py-4 border-t border-blue-800/30 bg-gradient-to-r from-blue-900/80 to-blue-800/80 flex items-center justify-between" style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="flex items-center gap-2 text-[13px] font-medium text-blue-300 hover:text-white hover:bg-blue-700/40 rounded-xl px-4 py-2 transition-all duration-150"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-blue-300/60 font-mono">⌘+Enter to save • Page Up/Down to scroll</span>
            <Button
              type="button"
              onClick={handleManualSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl px-4 py-2 text-[13px] font-medium shadow-lg transition-all duration-150"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}