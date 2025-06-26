import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, X, Keyboard } from "lucide-react";
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
}

export default function SnippetEditor({ isOpen, onClose, editingSnippet }: SnippetEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [shortcut, setShortcut] = useState("");
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const shortcutInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<InsertSnippet>({
    resolver: zodResolver(insertSnippetSchema),
    defaultValues: {
      title: "",
      content: "",
      trigger: "",
      category: "General",
      description: "",
    },
  });

  // Get existing snippets to extract categories
  const { data: existingSnippets = [] } = useQuery<Snippet[]>({
    queryKey: ["/api/snippets"],
  });

  // Extract unique categories from existing snippets
  const getAvailableCategories = () => {
    const categories = new Set<string>(["General"]);
    existingSnippets.forEach(snippet => {
      if (
        snippet.category &&
        !snippet.title.startsWith('📁') &&
        !(snippet.trigger && snippet.trigger.startsWith('__folder__'))
      ) {
        categories.add(snippet.category);
      }
    });
    return Array.from(categories).sort();
  };

  const availableCategories = getAvailableCategories();

  // Reset form when opening/closing or editing different snippet
  useEffect(() => {
    if (isOpen) {
      if (editingSnippet) {
        form.reset({
          title: editingSnippet.title,
          content: editingSnippet.content,
          trigger: editingSnippet.trigger,
          category: editingSnippet.category || "General",
          description: editingSnippet.description || "",
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
          category: "General",
          description: "",
        });
        setShortcut("");
      }
    }
  }, [isOpen, editingSnippet, form]);

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
      
      return await apiRequest("POST", "/api/snippets", {
        ...data,
        trigger: uniqueTrigger,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({
        title: "Success",
        description: "Snippet created successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create snippet",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertSnippet) => {
      return await apiRequest("PUT", `/api/snippets/${editingSnippet!.id}`, data);
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
      toast({
        title: "Error",
        description: error.message || "Failed to update snippet",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertSnippet) => {
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
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
      }
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
      form.handleSubmit(onSubmit)();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-2xl mx-auto rounded-2xl shadow-2xl bg-gradient-to-br from-gray-900/95 to-gray-800/95 border border-gray-700 overflow-hidden"
        style={{ minHeight: 500 }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-700">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0 rounded-lg hover:bg-gray-700/60 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        className="text-[13px] font-medium text-gray-300"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                      >
                        Title *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter snippet title" 
                          className="rounded-xl text-[14px] border-0 bg-gray-800 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                        className="text-[13px] font-medium text-gray-300"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                      >
                        Trigger
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., useeffect, cl, arrow" 
                          className="rounded-xl font-mono text-[14px] border-0 bg-gray-800 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel 
                        className="text-[13px] font-medium text-gray-300"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                      >
                        Category
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger 
                            className="rounded-xl text-[14px] border-0 bg-gray-800 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                          >
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {availableCategories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel 
                    className="text-[13px] font-medium text-gray-300"
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
                      className="rounded-xl text-[14px] border-0 bg-gray-800 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    />
                    <Button
                      type="button"
                      variant={isRecordingShortcut ? "destructive" : "outline"}
                      onClick={isRecordingShortcut ? stopRecordingShortcut : startRecordingShortcut}
                      className="px-4 rounded-xl border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    >
                      <Keyboard className="h-4 w-4 mr-2" />
                      {isRecordingShortcut ? "Stop" : "Record"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
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
                      className="text-[13px] font-medium text-gray-300"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
                    >
                      Content *
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your snippet content here..."
                        className="min-h-[200px] rounded-xl font-mono text-[14px] resize-none border-0 bg-gray-800 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-900/80">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="flex items-center gap-2 text-[13px] font-medium text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-xl px-4 py-2"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 font-mono">⌘+Enter to save</span>
            <Button
              type="submit"
              disabled={isSaving}
              onClick={form.handleSubmit(onSubmit)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2 text-[13px] font-medium"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : editingSnippet ? "Update Snippet" : "Create Snippet"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}