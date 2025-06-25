import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Settings, RotateCcw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Settings as SettingsType } from "@shared/schema";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [formData, setFormData] = useState({
    snippetShortcut: "ctrl+;",
    clipboardShortcut: "ctrl+shift+v",
    clipboardEnabled: true,
    historyLimit: 100,
    launchOnStartup: false,
    theme: "light",
  });
  const { toast } = useToast();

  const { data: settings } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        snippetShortcut: settings.snippetShortcut,
        clipboardShortcut: settings.clipboardShortcut,
        clipboardEnabled: settings.clipboardEnabled === 1,
        historyLimit: settings.historyLimit,
        launchOnStartup: settings.launchOnStartup === 1,
        theme: settings.theme,
      });
    }
  }, [settings]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      clipboardEnabled: formData.clipboardEnabled ? 1 : 0,
      launchOnStartup: formData.launchOnStartup ? 1 : 0,
    };
    
    updateSettingsMutation.mutate(submitData);
  };

  const resetToDefaults = () => {
    setFormData({
      snippetShortcut: "ctrl+;",
      clipboardShortcut: "ctrl+shift+v",
      clipboardEnabled: true,
      historyLimit: 100,
      launchOnStartup: false,
      theme: "light",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-gray-600" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6">
          {/* Keyboard Shortcuts */}
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Label htmlFor="snippetShortcut" className="text-sm text-gray-700">
                  Open Snippets
                </Label>
                <Input
                  id="snippetShortcut"
                  type="text"
                  value={formData.snippetShortcut}
                  onChange={(e) => handleInputChange("snippetShortcut", e.target.value)}
                  className="w-32 text-xs font-mono text-center"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Label htmlFor="clipboardShortcut" className="text-sm text-gray-700">
                  Open Clipboard History
                </Label>
                <Input
                  id="clipboardShortcut"
                  type="text"
                  value={formData.clipboardShortcut}
                  onChange={(e) => handleInputChange("clipboardShortcut", e.target.value)}
                  className="w-32 text-xs font-mono text-center"
                />
              </div>
            </div>
          </div>

          {/* Clipboard Settings */}
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-4">Clipboard History</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="clipboardEnabled" className="text-sm text-gray-700">
                    Enable clipboard monitoring
                  </Label>
                  <p className="text-xs text-gray-500">Automatically save copied text</p>
                </div>
                <Switch
                  id="clipboardEnabled"
                  checked={formData.clipboardEnabled}
                  onCheckedChange={(checked) => handleInputChange("clipboardEnabled", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="historyLimit" className="text-sm text-gray-700">
                  History limit
                </Label>
                <Select 
                  value={formData.historyLimit.toString()} 
                  onValueChange={(value) => handleInputChange("historyLimit", parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 items</SelectItem>
                    <SelectItem value="100">100 items</SelectItem>
                    <SelectItem value="200">200 items</SelectItem>
                    <SelectItem value="500">500 items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* General Settings */}
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-4">General</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="launchOnStartup" className="text-sm text-gray-700">
                    Launch on startup
                  </Label>
                  <p className="text-xs text-gray-500">Start SnipClip when system boots</p>
                </div>
                <Switch
                  id="launchOnStartup"
                  checked={formData.launchOnStartup}
                  onCheckedChange={(checked) => handleInputChange("launchOnStartup", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="theme" className="text-sm text-gray-700">
                  Theme
                </Label>
                <Select 
                  value={formData.theme} 
                  onValueChange={(value) => handleInputChange("theme", value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
          <Button
            type="button"
            variant="ghost"
            onClick={resetToDefaults}
            className="flex items-center gap-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateSettingsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={updateSettingsMutation.isPending}
            >
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
