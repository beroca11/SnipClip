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
  type UserCredentials 
} from "./auth";

// Extend Request interface to include userId
interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Middleware to extract user ID from session
  const authenticateUser = (req: AuthenticatedRequest, res: any, next: any) => {
    const sessionToken = req.headers["x-session-token"] as string;
    const userId = req.headers["x-user-id"] as string;
    
    if (sessionToken) {
      const session = getSession(sessionToken);
      if (session) {
        req.userId = session.userId;
        return next();
      }
    }
    
    if (userId) {
      // Fallback for backward compatibility
      req.userId = userId;
      return next();
    }
    
    res.status(401).json({ message: "Authentication required" });
  };

  // Snippets routes
  app.get("/api/snippets", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const snippets = await storage.getSnippets(userId);
      res.json(snippets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch snippets" });
    }
  });

  app.post("/api/snippets", authenticateUser, async (req: AuthenticatedRequest, res) => {
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create snippet" });
    }
  });

  app.put("/api/snippets/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
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
      res.status(500).json({ message: "Failed to update snippet" });
    }
  });

  app.delete("/api/snippets/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
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
  app.get("/api/clipboard", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      const items = await storage.getClipboardItems(userId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clipboard items" });
    }
  });

  app.post("/api/clipboard", authenticateUser, async (req: AuthenticatedRequest, res) => {
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

  app.delete("/api/clipboard/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
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

  app.delete("/api/clipboard", authenticateUser, async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    try {
      await storage.clearClipboardHistory(userId);
      res.json({ message: "Clipboard history cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear clipboard history" });
    }
  });

  // Settings routes
  app.get("/api/settings", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", authenticateUser, async (req: AuthenticatedRequest, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
