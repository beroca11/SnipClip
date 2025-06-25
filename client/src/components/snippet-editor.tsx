import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, X } from "lucide-react";
import { PopupOverlay } from "@/components/popup-overlay";
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
      } else {
        form.reset({
          title: "",
          content: "",
          trigger: "",
          category: "General",
          description: "",
        });
      }
    }
  }, [isOpen, editingSnippet, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertSnippet) => {
      return await apiRequest("/api/snippets", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
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
      return await apiRequest(`/api/snippets/${editingSnippet!.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
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
    onClose();
  };

  return (
    <PopupOverlay 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={editingSnippet ? "Edit Snippet" : "Create New Snippet"}
      icon={<Plus className="h-5 w-5 text-primary" />}
    >
      <div className="flex flex-col h-full">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            {/* Form Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter snippet title" 
                          className="rounded-xl"
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
                      <FormLabel>Trigger</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., useeffect, cl, arrow" 
                          className="rounded-xl font-mono"
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
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="JavaScript">JavaScript</SelectItem>
                          <SelectItem value="React">React</SelectItem>
                          <SelectItem value="HTML">HTML</SelectItem>
                          <SelectItem value="CSS">CSS</SelectItem>
                          <SelectItem value="Python">Python</SelectItem>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Brief description of the snippet" 
                          className="rounded-xl"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your snippet content here..."
                        className="min-h-[200px] rounded-xl font-mono text-sm resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100 bg-gray-50 px-6 py-5">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                className="flex items-center gap-2 text-sm font-medium hover:bg-white rounded-xl px-4 py-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl px-6 py-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : editingSnippet ? "Update Snippet" : "Create Snippet"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </PopupOverlay>
  );
}