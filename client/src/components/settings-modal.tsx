import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, X, Keyboard, TrashIcon } from "lucide-react";
import { PopupOverlay } from "@/components/popup-overlay";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSettingsSchema, type Settings as SettingsType, type InsertSettings } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShortcutInput } from "@/components/ui/shortcut-input";
import { ShortcutTester } from "@/components/ui/shortcut-tester";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings, isLoading } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
    enabled: isOpen,
  });

  const form = useForm<InsertSettings>({
    resolver: zodResolver(insertSettingsSchema),
    defaultValues: {
      snippetShortcut: "ctrl+;",
      clipboardShortcut: "ctrl+shift+v",
      clipboardEnabled: 1,
      historyLimit: 100,
      launchOnStartup: 0,
      theme: "light",
    },
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        snippetShortcut: settings.snippetShortcut,
        clipboardShortcut: settings.clipboardShortcut,
        clipboardEnabled: settings.clipboardEnabled,
        historyLimit: settings.historyLimit,
        launchOnStartup: settings.launchOnStartup,
        theme: settings.theme,
      });
    }
  }, [settings, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: InsertSettings) => {
      return await apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: InsertSettings) => {
    console.log("Submitting settings", data);
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync(data);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (settings) {
      form.reset({
        snippetShortcut: settings.snippetShortcut,
        clipboardShortcut: settings.clipboardShortcut,
        clipboardEnabled: settings.clipboardEnabled,
        historyLimit: settings.historyLimit,
        launchOnStartup: settings.launchOnStartup,
        theme: settings.theme,
      });
    }
    onClose();
  };

  const parseShortcut = (shortcut: string) => {
    const parts = shortcut.toLowerCase().split('+');
    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];
    return { modifiers, key };
  };

  const formatShortcut = (modifiers: string[], key: string) => {
    return [...modifiers, key].join('+');
  };

  const handleShortcutChange = (field: any, modifiers: string[], key: string) => {
    const shortcut = formatShortcut(modifiers, key);
    field.onChange(shortcut);
  };

  return (
    <PopupOverlay 
      isOpen={isOpen} 
      onClose={handleClose} 
      title="Settings"
      icon={<Settings className="h-5 w-5 text-primary" />}
    >
      <div className="flex flex-col h-full">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-500">Loading settings...</p>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              {/* Form Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                
                {/* Keyboard Shortcuts Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Keyboard className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h3>
                  </div>
                  
                  <div className="grid gap-6">
                    <FormField
                      control={form.control}
                      name="snippetShortcut"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Snippets Shortcut</FormLabel>
                          <FormControl>
                            <div className="space-y-3">
                              <ShortcutInput
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder="e.g., ctrl+;"
                                className="rounded-xl font-mono"
                                showSaveButton={true}
                                onSave={async (value) => {
                                  await updateMutation.mutateAsync({
                                    snippetShortcut: value
                                  });
                                }}
                              />
                              <ShortcutTester 
                                shortcut={field.value || ""} 
                                onTrigger={() => {
                                  // This would trigger the snippets modal in a real app
                                  console.log("Snippets shortcut triggered!");
                                }}
                              />
                              <div className="flex gap-2 text-sm text-gray-600">
                                <span>Examples:</span>
                                <code className="px-2 py-1 bg-gray-100 rounded">ctrl+;</code>
                                <code className="px-2 py-1 bg-gray-100 rounded">cmd+shift+s</code>
                                <code className="px-2 py-1 bg-gray-100 rounded">alt+space</code>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="clipboardShortcut"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clipboard History Shortcut</FormLabel>
                          <FormControl>
                            <div className="space-y-3">
                              <ShortcutInput
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder="e.g., ctrl+shift+v"
                                className="rounded-xl font-mono"
                                showSaveButton={true}
                                onSave={async (value) => {
                                  await updateMutation.mutateAsync({
                                    clipboardShortcut: value
                                  });
                                }}
                              />
                              <ShortcutTester 
                                shortcut={field.value || ""} 
                                onTrigger={() => {
                                  // This would trigger the clipboard modal in a real app
                                  console.log("Clipboard shortcut triggered!");
                                }}
                              />
                              <div className="flex gap-2 text-sm text-gray-600">
                                <span>Examples:</span>
                                <code className="px-2 py-1 bg-gray-100 rounded">ctrl+shift+v</code>
                                <code className="px-2 py-1 bg-gray-100 rounded">cmd+h</code>
                                <code className="px-2 py-1 bg-gray-100 rounded">alt+c</code>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Clipboard Settings Section */}
                <div className="space-y-6 border-t border-gray-200 pt-8">
                  <h3 className="text-lg font-semibold text-gray-900">Clipboard Settings</h3>
                  
                  <div className="grid gap-6">
                    <FormField
                      control={form.control}
                      name="clipboardEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel>Enable Clipboard Monitoring</FormLabel>
                            <p className="text-sm text-gray-500">Automatically track clipboard changes</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === 1}
                              onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="historyLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clipboard History Limit</FormLabel>
                          <FormControl>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select history limit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="50">50 items</SelectItem>
                                <SelectItem value="100">100 items</SelectItem>
                                <SelectItem value="200">200 items</SelectItem>
                                <SelectItem value="500">500 items</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Application Settings Section */}
                <div className="space-y-6 border-t border-gray-200 pt-8">
                  <h3 className="text-lg font-semibold text-gray-900">Application Settings</h3>
                  
                  <div className="grid gap-6">
                    <FormField
                      control={form.control}
                      name="theme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Theme</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select theme" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="light">Light</SelectItem>
                                <SelectItem value="dark">Dark</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="launchOnStartup"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel>Launch on Startup</FormLabel>
                            <p className="text-sm text-gray-500">Start SnipClip when system boots</p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === 1}
                              onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
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
                  disabled={isSaving || updateMutation.isPending}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl px-6 py-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {isSaving || updateMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </PopupOverlay>
  );
}