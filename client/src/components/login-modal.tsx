import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";
import { Code } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (userId: string, sessionToken: string) => void;
}

export default function LoginModal({ isOpen, onLoginSuccess }: LoginModalProps) {
  const [pin, setPin] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
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
    <div className="overlay-backdrop flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-white to-indigo-100">
      <Card className="overlay-content max-w-md shadow-2xl rounded-2xl border-0 bg-white/90">
        <CardHeader className="text-center pb-2">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mb-2 shadow-lg">
              <Code className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-extrabold text-gray-900 tracking-tight">Welcome to SnipClip</CardTitle>
            <CardDescription className="text-base text-gray-600 mt-1">
              Sign in to access your snippets and clipboard data across all devices.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-lg font-semibold text-gray-800">PIN (4-6 digits)</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? "text" : "password"}
                  placeholder="1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  required
                  className="pr-10 text-lg"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                  tabIndex={-1}
                  onClick={() => setShowPin((v) => !v)}
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="passphrase" className="text-lg font-semibold text-gray-800">Passphrase (min 8 characters)</Label>
              <div className="relative">
                <Input
                  id="passphrase"
                  type={showPassphrase ? "text" : "password"}
                  placeholder="Enter your passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  minLength={8}
                  required
                  className="pr-10 text-lg"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                  tabIndex={-1}
                  onClick={() => setShowPassphrase((v) => !v)}
                >
                  {showPassphrase ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full text-lg py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
          <div className="mt-6 text-sm text-gray-600 bg-blue-50 rounded-xl p-4 shadow-inner">
            <p className="font-semibold text-blue-700 mb-1">How it works:</p>
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