import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSnippetSchema, insertClipboardItemSchema, insertSettingsSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Snippets routes
  app.get("/api/snippets", async (req, res) => {
    try {
      const snippets = await storage.getSnippets();
      res.json(snippets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch snippets" });
    }
  });

  app.post("/api/snippets", async (req, res) => {
    try {
      const data = insertSnippetSchema.parse(req.body);
      
      // Check if trigger already exists
      const existing = await storage.getSnippetByTrigger(data.trigger);
      if (existing) {
        return res.status(400).json({ message: "Trigger already exists" });
      }
      
      const snippet = await storage.createSnippet(data);
      res.status(201).json(snippet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create snippet" });
    }
  });

  app.put("/api/snippets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertSnippetSchema.partial().parse(req.body);
      
      // Check if new trigger conflicts with existing snippets
      if (data.trigger) {
        const existing = await storage.getSnippetByTrigger(data.trigger);
        if (existing && existing.id !== id) {
          return res.status(400).json({ message: "Trigger already exists" });
        }
      }
      
      const snippet = await storage.updateSnippet(id, data);
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

  app.delete("/api/snippets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSnippet(id);
      if (!deleted) {
        return res.status(404).json({ message: "Snippet not found" });
      }
      res.json({ message: "Snippet deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete snippet" });
    }
  });

  // Clipboard routes
  app.get("/api/clipboard", async (req, res) => {
    try {
      const items = await storage.getClipboardItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clipboard items" });
    }
  });

  app.post("/api/clipboard", async (req, res) => {
    try {
      const data = insertClipboardItemSchema.parse(req.body);
      const item = await storage.createClipboardItem(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create clipboard item" });
    }
  });

  app.delete("/api/clipboard/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClipboardItem(id);
      if (!deleted) {
        return res.status(404).json({ message: "Clipboard item not found" });
      }
      res.json({ message: "Clipboard item deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete clipboard item" });
    }
  });

  app.delete("/api/clipboard", async (req, res) => {
    try {
      await storage.clearClipboardHistory();
      res.json({ message: "Clipboard history cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear clipboard history" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
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
