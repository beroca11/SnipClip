import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PlusCircle, Save, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertSnippetSchema, type Snippet } from "@shared/schema";
import { z } from "zod";

interface SnippetEditorProps {
  isOpen: boolean;
  onClose: () => void;
  editingSnippet?: Snippet | null;
}

const formSchema = insertSnippetSchema.extend({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  trigger: z.string().min(1, "Trigger is required").regex(/^[a-zA-Z0-9_-]+$/, "Trigger can only contain letters, numbers, underscores, and hyphens"),
});

export default function SnippetEditor({ isOpen, onClose, editingSnippet }: SnippetEditorProps) {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    trigger: "",
    category: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/snippets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({
        title: "Snippet created",
        description: "Your snippet has been saved successfully.",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create snippet.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PUT", `/api/snippets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
      toast({
        title: "Snippet updated",
        description: "Your snippet has been updated successfully.",
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update snippet.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (editingSnippet) {
      setFormData({
        title: editingSnippet.title,
        content: editingSnippet.content,
        trigger: editingSnippet.trigger,
        category: editingSnippet.category || "",
        description: editingSnippet.description || "",
      });
    } else {
      resetForm();
    }
    setErrors({});
  }, [editingSnippet, isOpen]);

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      trigger: "",
      category: "",
      description: "",
    });
    setErrors({});
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = formSchema.parse(formData);
      
      if (editingSnippet) {
        updateMutation.mutate({ id: editingSnippet.id, data: validatedData });
      } else {
        createMutation.mutate(validatedData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <PlusCircle className="h-5 w-5 text-blue-600" />
            {editingSnippet ? "Edit Code Snippet" : "New Code Snippet"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                type="text"
                placeholder="e.g., React useEffect Hook"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className={errors.title ? "border-red-500" : ""}
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>
            <div>
              <Label htmlFor="trigger">Trigger Shortcut *</Label>
              <Input
                id="trigger"
                type="text"
                placeholder="e.g., useef"
                value={formData.trigger}
                onChange={(e) => handleInputChange("trigger", e.target.value)}
                className={`font-mono text-sm ${errors.trigger ? "border-red-500" : ""}`}
              />
              {errors.trigger && <p className="text-red-500 text-sm mt-1">{errors.trigger}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No category</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="react">React</SelectItem>
                <SelectItem value="css">CSS</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              rows={12}
              placeholder="Enter your code snippet or text here..."
              value={formData.content}
              onChange={(e) => handleInputChange("content", e.target.value)}
              className={`font-mono text-sm resize-none ${errors.content ? "border-red-500" : ""}`}
            />
            {errors.content && <p className="text-red-500 text-sm mt-1">{errors.content}</p>}
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              type="text"
              placeholder="Brief description of what this snippet does"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Preview functionality could be added here
                toast({
                  title: "Preview",
                  description: "Preview functionality coming soon!",
                });
              }}
              disabled={isPending}
            >
              Preview
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {editingSnippet ? "Update" : "Save"} Snippet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
