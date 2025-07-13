// Global error handling for WebSocket compatibility issues
process.on('uncaughtException', (error) => {
  if (error.message.includes('Cannot set property message of #<ErrorEvent>')) {
    console.warn('WebSocket error handled gracefully (Neon database compatibility issue)');
    return;
  }
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const message = (reason as any).message;
    if (message && message.includes('Cannot set property message of #<ErrorEvent>')) {
      console.warn('WebSocket promise rejection handled gracefully (Neon database compatibility issue)');
      return;
    }
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Security middleware
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline/eval needed for Vite dev mode
    "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for CSS-in-JS
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' wss: ws:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // Remove server fingerprinting
  res.removeHeader('X-Powered-By');
  
  next();
});

// CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5002',
    'http://localhost:5001',
    'https://snipclip.onrender.com'
  ];
  
  // Allow development origins
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:5002', 'http://127.0.0.1:5001');
  }
  
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-user-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Body parsing middleware with limits
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        // Don't log sensitive data
        const safeResponse = { ...capturedJsonResponse };
        if (safeResponse.sessionToken) {
          safeResponse.sessionToken = '[REDACTED]';
        }
        if (safeResponse.userId) {
          safeResponse.userId = '[REDACTED]';
        }
        logLine += ` :: ${JSON.stringify(safeResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      
      // Don't expose internal errors in production
      let message = "Internal Server Error";
      if (process.env.NODE_ENV === 'development') {
        message = err.message || "Internal Server Error";
      } else if (status >= 400 && status < 500) {
        message = err.message || "Bad Request";
      }
      
      console.error('Server error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        status,
        timestamp: new Date().toISOString()
      });
      
      res.status(status).json({ message });
    });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isDevelopment = app.get("env") === "development" || process.env.NODE_ENV === "development";
  const isProduction = app.get("env") === "production" || process.env.NODE_ENV === "production";
  
  // Check if build files exist to determine if we should use static serving
  const fs = await import("fs");
  const path = await import("path");
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  const buildFilesExist = fs.existsSync(distPath);
  
  console.log(`Environment detection: app.get("env") = "${app.get("env")}", process.env.NODE_ENV = "${process.env.NODE_ENV}", isDevelopment = ${isDevelopment}, isProduction = ${isProduction}, buildFilesExist = ${buildFilesExist}`);
  
  // Force static serving in production or if build files exist
  if (isProduction || buildFilesExist) {
    console.log("Setting up static file serving...");
    serveStatic(app);
  } else if (isDevelopment) {
    console.log("Setting up Vite development server...");
    await setupVite(app, server);
  } else {
    // Fallback: if we can't determine, try static first, then fallback to Vite
    console.log("Environment unclear, trying static serving first...");
    try {
      serveStatic(app);
    } catch (error) {
      console.log("Static serving failed, falling back to Vite development server...");
      await setupVite(app, server);
    }
  }

  // Serve the app on port 5001 (production) or 5002 (development)
  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 5001 : 5002);
  
  // Ensure NODE_ENV is set for production deployments
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
    console.log("NODE_ENV not set, defaulting to production");
  }
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port} in ${process.env.NODE_ENV} mode`);
    
    // Check if we need to run migrations
    if (process.env.DATABASE_URL) {
      console.log("🔧 Database URL detected, running migrations...");
      try {
        const { runMigrations } = await import("./migrations");
        await runMigrations();
      } catch (error) {
        console.error("❌ Migration failed:", error);
        console.log("💡 Try running: npm run db:setup");
      }
    } else {
      console.log("⚠️  No DATABASE_URL found. Using file storage.");
      console.log("💡 To migrate to PostgreSQL, run: npm run db:setup");
    }
  });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
