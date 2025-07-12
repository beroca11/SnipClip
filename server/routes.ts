import type { Express, Request, Response, NextFunction } from "express";
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
  isValidSessionToken,
  type UserCredentials 
} from "./auth";
import fs from "fs";
import path from "path";

// Rate limiting store (simple in-memory implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

// Simple rate limiting middleware
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Clean up expired entries
  const entriesToDelete: string[] = [];
  rateLimitStore.forEach((value, key) => {
    if (now > value.resetTime) {
      entriesToDelete.push(key);
    }
  });
  
  entriesToDelete.forEach(key => rateLimitStore.delete(key));
  
  const current = rateLimitStore.get(clientIp);
  
  if (!current) {
    rateLimitStore.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (now > current.resetTime) {
    rateLimitStore.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (current.count >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({ 
      message: "Too many login attempts. Please try again later.",
      retryAfter: Math.ceil((current.resetTime - now) / 1000)
    });
  }
  
  current.count++;
  next();
}

// Extend Request interface to include userId
interface AuthenticatedRequest extends Request {
  userId?: string;
}

// Enhanced error handling wrapper
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Security utility functions
function sanitizeErrorMessage(error: any): string {
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production') {
    if (error instanceof z.ZodError) {
      return 'Validation error: ' + error.errors.map(e => e.message).join(', ');
    }
    if (error.message && error.message.includes('Folder with ID')) {
      return error.message; // Allow folder validation errors as they're user-facing
    }
    return 'An error occurred while processing your request';
  }
  return error.message || 'An error occurred';
}

// Log security events
function logSecurityEvent(event: string, details: any) {
  console.log(`[SECURITY] ${event}:`, {
    timestamp: new Date().toISOString(),
    ...details
  });
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
  app.post("/api/auth/login", rateLimitMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const { pin, passphrase } = req.body as UserCredentials;
    
    // Validate input
    if (!pin || !passphrase) {
      logSecurityEvent('LOGIN_ATTEMPT_MISSING_CREDENTIALS', { 
        ip: req.ip,
        userAgent: req.get('User-Agent') 
      });
      return res.status(400).json({ message: "PIN and passphrase are required" });
    }
    
    if (!validatePin(pin)) {
      logSecurityEvent('LOGIN_ATTEMPT_INVALID_PIN', { 
        ip: req.ip,
        userAgent: req.get('User-Agent') 
      });
      return res.status(400).json({ message: "PIN must be 4-6 digits" });
    }
    
    if (!validatePassphrase(passphrase)) {
      logSecurityEvent('LOGIN_ATTEMPT_INVALID_PASSPHRASE', { 
        ip: req.ip,
        userAgent: req.get('User-Agent') 
      });
      return res.status(400).json({ message: "Passphrase must be at least 8 characters and contain only letters, numbers, and special characters" });
    }
    
    // Generate consistent user ID
    const userId = generateUserId(pin, passphrase);
    
    // Create session with new secure method
    const sessionToken = createSession(userId);
    
    logSecurityEvent('LOGIN_SUCCESS', { 
      userId: userId.substring(0, 8) + '...', // Log partial ID only
      ip: req.ip 
    });
    
    res.json({
      success: true,
      userId,
      sessionToken,
      message: "Login successful"
    });
  }));

  app.post("/api/auth/logout", asyncHandler(async (req: Request, res: Response) => {
    const { sessionToken } = req.body;
    
    if (sessionToken && isValidSessionToken(sessionToken)) {
      const success = removeSession(sessionToken);
      if (success) {
        logSecurityEvent('LOGOUT_SUCCESS', { ip: req.ip });
      }
    }
    
    res.json({ success: true, message: "Logout successful" });
  }));

  app.get("/api/auth/verify", asyncHandler(async (req: Request, res: Response) => {
    const sessionToken = req.headers["x-session-token"] as string;
    
    if (!sessionToken || !isValidSessionToken(sessionToken)) {
      logSecurityEvent('AUTH_VERIFY_INVALID_TOKEN', { 
        ip: req.ip,
        tokenProvided: !!sessionToken 
      });
      return res.status(401).json({ message: "Invalid session token format" });
    }
    
    const session = getSession(sessionToken);
    if (!session) {
      logSecurityEvent('AUTH_VERIFY_EXPIRED_SESSION', { ip: req.ip });
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    
    res.json({
      success: true,
      userId: session.userId,
      message: "Session valid"
    });
  }));

  // Removed development authentication bypass endpoint for security

  // Enhanced authentication middleware with better error handling
  const authenticateUserMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const sessionToken = req.headers["x-session-token"] as string;
    const userId = req.headers["x-user-id"] as string;
    
    // Validate session token format if provided
    if (sessionToken && !isValidSessionToken(sessionToken)) {
      logSecurityEvent('AUTH_MIDDLEWARE_INVALID_TOKEN', { 
        ip: req.ip,
        endpoint: req.path 
      });
      return res.status(401).json({ message: "Invalid session token format" });
    }
    
    const authenticatedUserId = authenticateUser(sessionToken, userId);
    
    if (authenticatedUserId) {
      req.userId = authenticatedUserId;
      return next();
    }
    
    logSecurityEvent('AUTH_MIDDLEWARE_UNAUTHORIZED', { 
      ip: req.ip,
      endpoint: req.path,
      hasToken: !!sessionToken,
      hasUserId: !!userId
    });
    
    res.status(401).json({ message: "Authentication required" });
  };

  // Snippets routes with enhanced error handling
  app.get("/api/snippets", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const snippets = await storage.getSnippets(userId);
    res.json(snippets);
  }));

  app.post("/api/snippets", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const data = insertSnippetSchema.parse(req.body);
    
    const existing = await storage.getSnippetByTrigger(data.trigger, userId);
    if (existing) {
      return res.status(400).json({ message: "Trigger already exists" });
    }
    
    const snippet = await storage.createSnippet(data, userId);
    res.status(201).json(snippet);
  }));

  app.put("/api/snippets/:id", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid snippet ID" });
    }
    
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
  }));

  app.delete("/api/snippets/:id", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid snippet ID" });
    }
    
    const deleted = await storage.deleteSnippet(id, userId);
    if (!deleted) {
      return res.status(404).json({ message: "Snippet not found" });
    }
    
    res.json({ message: "Snippet deleted" });
  }));

  // Clipboard routes
  app.get("/api/clipboard", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const items = await storage.getClipboardItems(userId);
    res.json(items);
  }));

  app.post("/api/clipboard", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const data = insertClipboardItemSchema.parse(req.body);
    const item = await storage.createClipboardItem(data, userId);
    res.status(201).json(item);
  }));

  app.delete("/api/clipboard/:id", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid clipboard item ID" });
    }
    
    const deleted = await storage.deleteClipboardItem(id, userId);
    if (!deleted) {
      return res.status(404).json({ message: "Clipboard item not found" });
    }
    
    res.json({ message: "Clipboard item deleted" });
  }));

  app.delete("/api/clipboard", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId!;
    await storage.clearClipboardHistory(userId);
    res.json({ message: "Clipboard history cleared" });
  }));

  // Settings routes
  app.get("/api/settings", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await storage.getSettings();
    res.json(settings);
  }));

  app.put("/api/settings", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    console.log("PUT /api/settings - Request body:", req.body);
    const data = insertSettingsSchema.partial().parse(req.body);
    console.log("PUT /api/settings - Parsed data:", data);
    const settings = await storage.updateSettings(data);
    console.log("PUT /api/settings - Updated settings:", settings);
    res.json(settings);
  }));

  // Folders routes
  app.get("/api/folders", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
    try {
      // Ensure General folder exists for the user
      await storage.ensureGeneralFolder(req.userId!);
      
      const folders = await storage.getFolders(req.userId!);
      res.json(folders);
    } catch (error) {
      console.error("[GET /api/folders]", error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  }));

  app.get("/api/folders/:id", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
    try {
      const folder = await storage.getFolder(Number(req.params.id), req.userId!);
      if (!folder) return res.status(404).json({ message: "Folder not found" });
      res.json(folder);
    } catch (error) {
      console.error("[GET /api/folders/:id]", error);
      res.status(500).json({ message: "Failed to fetch folder" });
    }
  }));

  app.post("/api/folders", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
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
  }));

  app.put("/api/folders/:id", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
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
  }));

  // Specific rename endpoint for better UX
  app.patch("/api/folders/:id/rename", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
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
  }));

  app.delete("/api/folders/:id", authenticateUserMiddleware, asyncHandler(async (req: AuthenticatedRequest, res) => {
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
  }));

  // Global error handler for routes
  app.use('/api/*', (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('API Error:', {
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    const status = err.status || err.statusCode || 500;
    const message = sanitizeErrorMessage(err);
    
    res.status(status).json({ message });
  });

  const httpServer = createServer(app);
  return httpServer;
}
