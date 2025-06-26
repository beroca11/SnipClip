import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (userId: string, sessionToken: string) => void;
}

export default function LoginModal({ isOpen, onLoginSuccess }: LoginModalProps) {
  const [pin, setPin] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin || !passphrase) {
      toast({
        title: "Error",
        description: "Please enter both PIN and passphrase",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        pin,
        passphrase,
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Store session token in localStorage
        localStorage.setItem("sessionToken", data.sessionToken);
        localStorage.setItem("userKey", data.userId);
        
        toast({
          title: "Success",
          description: "Login successful! Your data will sync across devices.",
        });
        
        onLoginSuccess(data.userId, data.sessionToken);
      } else {
        toast({
          title: "Error",
          description: data.message || "Login failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "Login failed. Please check your PIN and passphrase.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to SnipClip</CardTitle>
          <CardDescription>
            Enter your PIN and passphrase to access your snippets and clipboard data across all devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (4-6 digits)</Label>
              <Input
                id="pin"
                type="password"
                placeholder="1234"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                pattern="[0-9]*"
                inputMode="numeric"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="passphrase">Passphrase (min 8 characters)</Label>
              <Input
                id="passphrase"
                type="password"
                placeholder="Enter your passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                minLength={8}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
          
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Use the same PIN and passphrase on any device</li>
              <li>Your data will automatically sync</li>
              <li>No account creation required</li>
              <li>Your data is stored locally and securely</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 