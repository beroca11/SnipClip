import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
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

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error('Server error:', err);
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

  // ALWAYS serve the app on port 5001
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
    const port = 5001;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, async () => {
      log(`serving on port ${port}`);
      
      // Run any pending migrations
      try {
        const { runMigrations } = await import("./migrations");
        await runMigrations();
      } catch (error) {
        console.log("Migration system not available or no migrations needed");
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
