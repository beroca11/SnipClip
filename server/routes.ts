import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSnippetSchema, insertClipboardItemSchema, insertSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { 
  generateUserId, 
  validatePin, 
  validatePassphrase, 
  createSession, 
  getSession,
  removeSession,
  authenticateUser,
  type UserCredentials 
} from "./auth";
import fs from "fs";
import path from "path";

// Extend Request interface to include userId
interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (no authentication required)
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { pin, passphrase } = req.body as UserCredentials;
      
      // Validate input
      if (!pin || !passphrase) {
        return res.status(400).json({ message: "PIN and passphrase are required" });
      }
      
      if (!validatePin(pin)) {
        return res.status(400).json({ message: "PIN must be 4-6 digits" });
      }
      
      if (!validatePassphrase(passphrase)) {
        return res.status(400).json({ message: "Passphrase must be at least 8 characters and contain only letters, numbers, and special characters" });
      }
      
      // Generate consistent user ID
      const userId = generateUserId(pin, passphrase);
      
      // Create session
      const sessionToken = createSession(userId, pin, passphrase);
      
      res.json({
        success: true,
        userId,
        sessionToken,
        message: "Login successful"
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const { sessionToken } = req.body;
      
      if (sessionToken) {
        removeSession(sessionToken);
      }
      
      res.json({ success: true, message: "Logout successful" });
    } catch (error) {
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.get("/api/auth/verify", async (req, res) => {
    try {
      const sessionToken = req.headers["x-session-token"] as string;
      
      if (!sessionToken) {
        return res.status(401).json({ message: "No session token provided" });
      }
      
      const session = getSession(sessionToken);
      if (!session) {
        return res.status(401).json({ message: "Invalid or expired session" });
      }
      
      res.json({
        success: true,
        userId: session.userId,
        message: "Session valid"
      });
    } catch (error) {
      res.status(500).json({ message: "Session verification failed" });
    }
  });

  // Development mode authentication bypass
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/auth/dev-login", async (req, res) => {
      try {
        const { pin, passphrase } = req.body as UserCredentials;
        
        if (!pin || !passphrase) {
          return res.status(400).json({ message: "PIN and passphrase are required" });
        }
        
        // Generate consistent user ID
        const userId = generateUserId(pin, passphrase);
        
        // Create session
        const sessionToken = createSession(userId, pin, passphrase);
        
        res.json({
          success: true,
          userId,
          sessionToken,
          message: "Development login successful"
        });
      } catch (error) {
        res.status(500).json({ message: "Development login failed" });
      }
    });
  }

  // Middleware to extract user ID from session
  const authenticateUserMiddleware = (req: AuthenticatedRequest, res: any, next: any) => {
    const sessionToken = req.headers["x-session-token"] as string;
    const userId = req.headers["x-user-id"] as string;
    
    const authenticatedUserId = authenticateUser(sessionToken, userId);
    
    if (authenticatedUserId) {
      req.userId = authenticatedUserId;
      return next();
    }
    
    res.status(401).json({ message: "Authentication required" });
  };

  // Snippets routes
  app.get("/api/snippets", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const snippets = await storage.getSnippets(userId);
      res.json(snippets);
    } catch (error) {
      console.error("[GET /api/snippets]", error);
      res.status(500).json({ message: "Failed to fetch snippets" });
    }
  });

  app.post("/api/snippets", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const data = insertSnippetSchema.parse(req.body);
      const existing = await storage.getSnippetByTrigger(data.trigger, userId);
      if (existing) {
        return res.status(400).json({ message: "Trigger already exists" });
      }
      const snippet = await storage.createSnippet(data, userId);
      res.status(201).json(snippet);
    } catch (error) {
      console.error("[POST /api/snippets]", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      // Check if it's a folder validation error
      if (error instanceof Error && error.message.includes("Folder with ID") && error.message.includes("does not exist")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create snippet" });
    }
  });

  app.put("/api/snippets/:id", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const id = parseInt(req.params.id);
      const data = insertSnippetSchema.partial().parse(req.body);
      if (data.trigger) {
        const existing = await storage.getSnippetByTrigger(data.trigger, userId);
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: "Trigger already exists" });
        }
      }
      const snippet = await storage.updateSnippet(id, data, userId);
      if (!snippet) {
        return res.status(404).json({ message: "Snippet not found" });
      }
      res.json(snippet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      // Check if it's a folder validation error
      if (error instanceof Error && error.message.includes("Folder with ID") && error.message.includes("does not exist")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update snippet" });
    }
  });

  app.delete("/api/snippets/:id", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSnippet(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Snippet not found" });
      }
      res.json({ message: "Snippet deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete snippet" });
    }
  });

  // Clipboard routes
  app.get("/api/clipboard", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const items = await storage.getClipboardItems(userId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clipboard items" });
    }
  });

  app.post("/api/clipboard", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const data = insertClipboardItemSchema.parse(req.body);
      const item = await storage.createClipboardItem(data, userId);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create clipboard item" });
    }
  });

  app.delete("/api/clipboard/:id", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClipboardItem(id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Clipboard item not found" });
      }
      res.json({ message: "Clipboard item deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete clipboard item" });
    }
  });

  app.delete("/api/clipboard", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      await storage.clearClipboardHistory(userId);
      res.json({ message: "Clipboard history cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear clipboard history" });
    }
  });

  // Settings routes
  app.get("/api/settings", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      console.log("PUT /api/settings - Request body:", req.body);
      const data = insertSettingsSchema.partial().parse(req.body);
      console.log("PUT /api/settings - Parsed data:", data);
      const settings = await storage.updateSettings(data);
      console.log("PUT /api/settings - Updated settings:", settings);
      res.json(settings);
    } catch (error) {
      console.error("PUT /api/settings - Error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Folders routes
  app.get("/api/folders", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      // Ensure General folder exists for the user
      await storage.ensureGeneralFolder(req.userId!);
      
      const folders = await storage.getFolders(req.userId!);
      res.json(folders);
    } catch (error) {
      console.error("[GET /api/folders]", error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  app.get("/api/folders/:id", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const folder = await storage.getFolder(Number(req.params.id), req.userId!);
      if (!folder) return res.status(404).json({ message: "Folder not found" });
      res.json(folder);
    } catch (error) {
      console.error("[GET /api/folders/:id]", error);
      res.status(500).json({ message: "Failed to fetch folder" });
    }
  });

  app.post("/api/folders", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Folder name is required" });
      
      // Prevent creation of "General" folder as it's reserved
      if (name.toLowerCase() === "general") {
        return res.status(400).json({ message: "Cannot create folder named 'General' as it's a reserved name" });
      }
      
      const folder = await storage.createFolder(name, req.userId!);
      res.status(201).json(folder);
    } catch (error) {
      console.error("[POST /api/folders]", error);
      if (error instanceof Error && error.message.includes("Folder name already exists")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.put("/api/folders/:id", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Folder name is required" });
      
      // Prevent renaming to "General" as it's reserved
      if (name.toLowerCase() === "general") {
        return res.status(400).json({ message: "Cannot rename folder to 'General' as it's a reserved name" });
      }
      
      const folder = await storage.updateFolder(Number(req.params.id), name, req.userId!);
      if (!folder) return res.status(404).json({ message: "Folder not found" });
      res.json(folder);
    } catch (error) {
      console.error("[PUT /api/folders/:id]", error);
      if (error instanceof Error && error.message.includes("Folder name already exists")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update folder" });
    }
  });

  // Specific rename endpoint for better UX
  app.patch("/api/folders/:id/rename", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Folder name is required" });
      
      // Prevent renaming to "General" as it's reserved
      if (name.toLowerCase() === "general") {
        return res.status(400).json({ message: "Cannot rename folder to 'General' as it's a reserved name" });
      }
      
      const folder = await storage.updateFolder(Number(req.params.id), name, req.userId!);
      if (!folder) return res.status(404).json({ message: "Folder not found" });
      res.json(folder);
    } catch (error) {
      console.error("[PATCH /api/folders/:id/rename]", error);
      if (error instanceof Error && error.message.includes("Folder name already exists")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to rename folder" });
    }
  });

  app.delete("/api/folders/:id", authenticateUserMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const folderId = Number(req.params.id);
      
      // Get the folder to check if it's the General folder
      const folder = await storage.getFolder(folderId, req.userId!);
      if (folder && folder.name === "General") {
        return res.status(400).json({ message: "Cannot delete the 'General' folder as it's a reserved system folder" });
      }
      
      const ok = await storage.deleteFolder(folderId, req.userId!);
      if (!ok) return res.status(404).json({ message: "Folder not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/folders/:id]", error);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
