import { 
  snippets, 
  clipboardItems, 
  settings,
  type Snippet, 
  type InsertSnippet,
  type ClipboardItem,
  type InsertClipboardItem,
  type Settings,
  type InsertSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gt } from "drizzle-orm";

export interface IStorage {
  // Snippets
  getSnippets(userId: string): Promise<Snippet[]>;
  getSnippet(id: number, userId: string): Promise<Snippet | undefined>;
  getSnippetByTrigger(trigger: string, userId: string): Promise<Snippet | undefined>;
  createSnippet(snippet: InsertSnippet, userId: string): Promise<Snippet>;
  updateSnippet(id: number, snippet: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined>;
  deleteSnippet(id: number, userId: string): Promise<boolean>;
  
  // Clipboard
  getClipboardItems(userId: string): Promise<ClipboardItem[]>;
  createClipboardItem(item: InsertClipboardItem, userId: string): Promise<ClipboardItem>;
  deleteClipboardItem(id: number, userId: string): Promise<boolean>;
  clearClipboardHistory(userId: string): Promise<void>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
}

export class MemStorage implements IStorage {
  private snippets: Map<number, Snippet>;
  private clipboardItems: Map<number, ClipboardItem>;
  private settings: Settings;
  private currentSnippetId: number;
  private currentClipboardId: number;

  constructor() {
    this.snippets = new Map();
    this.clipboardItems = new Map();
    this.currentSnippetId = 1;
    this.currentClipboardId = 1;
    
    // Default settings
    this.settings = {
      id: 1,
      snippetShortcut: "ctrl+;",
      clipboardShortcut: "ctrl+shift+v",
      clipboardEnabled: 1,
      historyLimit: 100,
      launchOnStartup: 0,
      theme: "light",
    };

    // Add some initial snippets for demo
    this.initializeDefaultSnippets();
  }

  private initializeDefaultSnippets() {
    const defaultSnippets: Omit<InsertSnippet, 'userId'>[] = [
      {
        title: "React useEffect Hook",
        content: `useEffect(() => {
  // Effect logic here
  return () => {
    // Cleanup
  };
}, [dependency]);`,
        trigger: "useef",
        category: "javascript",
        description: "Basic React useEffect hook with cleanup"
      },
      {
        title: "Console Log Debug",
        content: "console.log('DEBUG:', variable);",
        trigger: "clog",
        category: "debug",
        description: "Quick console log for debugging"
      },
      {
        title: "Email Template",
        content: `Subject: Follow-up on our meeting\n\nHi [Name],\n\nThank you for taking the time to meet with me today. I wanted to follow up on our discussion about...\n\nBest regards,\n[Your Name]`,
        trigger: "email",
        category: "template",
        description: "Professional email template"
      }
    ];
    const demoUserId = "demo-user";
    defaultSnippets.forEach(snippet => {
      const id = this.currentSnippetId++;
      const now = new Date();
      this.snippets.set(id, {
        ...snippet,
        id,
        userId: demoUserId,
        category: snippet.category || null,
        description: snippet.description || null,
        parentId: null,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  async getSnippets(userId: string): Promise<Snippet[]> {
    return Array.from(this.snippets.values())
      .filter(snippet => snippet.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getSnippet(id: number, userId: string): Promise<Snippet | undefined> {
    const snippet = this.snippets.get(id);
    return snippet && snippet.userId === userId ? snippet : undefined;
  }

  async getSnippetByTrigger(trigger: string, userId: string): Promise<Snippet | undefined> {
    return Array.from(this.snippets.values()).find(
      snippet => snippet.trigger === trigger && snippet.userId === userId
    );
  }

  async createSnippet(insertSnippet: InsertSnippet, userId: string): Promise<Snippet> {
    const id = this.currentSnippetId++;
    const now = new Date();
    const snippet: Snippet = {
      ...insertSnippet,
      id,
      userId,
      category: insertSnippet.category || null,
      description: insertSnippet.description || null,
      parentId: insertSnippet.parentId || null,
      createdAt: now,
      updatedAt: now,
    };
    this.snippets.set(id, snippet);
    return snippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined> {
    const existing = this.snippets.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: Snippet = {
      ...existing,
      ...updateData,
      updatedAt: new Date(),
    };
    this.snippets.set(id, updated);
    return updated;
  }

  async deleteSnippet(id: number, userId: string): Promise<boolean> {
    const snippet = this.snippets.get(id);
    if (!snippet || snippet.userId !== userId) return false;
    return this.snippets.delete(id);
  }

  async getClipboardItems(userId: string): Promise<ClipboardItem[]> {
    return Array.from(this.clipboardItems.values())
      .filter(item => item.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createClipboardItem(insertItem: InsertClipboardItem, userId: string): Promise<ClipboardItem> {
    // Check for recent duplicates (within last 5 seconds)
    const recentItems = Array.from(this.clipboardItems.values())
      .filter(item => {
        const timeDiff = Date.now() - item.createdAt.getTime();
        return timeDiff < 5000 && item.userId === userId;
      });
    // If the same content was added recently, don't add it again
    const isDuplicate = recentItems.some(item =>
      item.content === insertItem.content &&
      item.type === (insertItem.type || "text")
    );
    if (isDuplicate) {
      return recentItems.find(item =>
        item.content === insertItem.content &&
        item.type === (insertItem.type || "text")
      )!;
    }
    const id = this.currentClipboardId++;
    const item: ClipboardItem = {
      ...insertItem,
      id,
      userId,
      type: insertItem.type || "text",
      createdAt: new Date(),
    };
    this.clipboardItems.set(id, item);
    // Maintain history limit
    const items = await this.getClipboardItems(userId);
    if (items.length > this.settings.historyLimit) {
      const itemsToDelete = items.slice(this.settings.historyLimit);
      itemsToDelete.forEach(item => this.clipboardItems.delete(item.id));
    }
    return item;
  }

  async deleteClipboardItem(id: number, userId: string): Promise<boolean> {
    const item = this.clipboardItems.get(id);
    if (!item || item.userId !== userId) return false;
    return this.clipboardItems.delete(id);
  }

  async clearClipboardHistory(userId: string): Promise<void> {
    Array.from(this.clipboardItems.values())
      .filter(item => item.userId === userId)
      .forEach(item => this.clipboardItems.delete(item.id));
  }

  async getSettings(): Promise<Settings> {
    return this.settings;
  }

  async updateSettings(updateData: Partial<InsertSettings>): Promise<Settings> {
    this.settings = { ...this.settings, ...updateData };
    return this.settings;
  }
}

export class DatabaseStorage implements IStorage {
  // Snippets
  async getSnippets(userId: string): Promise<Snippet[]> {
    if (!db) throw new Error("Database not available");
    return await db.select().from(snippets).where(eq(snippets.userId, userId)).orderBy(desc(snippets.createdAt));
  }

  async getSnippet(id: number, userId: string): Promise<Snippet | undefined> {
    if (!db) throw new Error("Database not available");
    const [snippet] = await db.select().from(snippets).where(and(eq(snippets.id, id), eq(snippets.userId, userId)));
    return snippet;
  }

  async getSnippetByTrigger(trigger: string, userId: string): Promise<Snippet | undefined> {
    if (!db) throw new Error("Database not available");
    const [snippet] = await db.select().from(snippets).where(and(eq(snippets.trigger, trigger), eq(snippets.userId, userId)));
    return snippet;
  }

  async createSnippet(snippet: InsertSnippet, userId: string): Promise<Snippet> {
    if (!db) throw new Error("Database not available");
    const [newSnippet] = await db.insert(snippets).values({
      ...snippet,
      userId,
      updatedAt: new Date()
    }).returning();
    return newSnippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined> {
    if (!db) throw new Error("Database not available");
    const [updated] = await db.update(snippets)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(snippets.id, id), eq(snippets.userId, userId)))
      .returning();
    return updated;
  }

  async deleteSnippet(id: number, userId: string): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(snippets).where(and(eq(snippets.id, id), eq(snippets.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Clipboard
  async getClipboardItems(userId: string): Promise<ClipboardItem[]> {
    if (!db) throw new Error("Database not available");
    return await db.select().from(clipboardItems).where(eq(clipboardItems.userId, userId)).orderBy(desc(clipboardItems.createdAt)).limit(100);
  }

  async createClipboardItem(item: InsertClipboardItem, userId: string): Promise<ClipboardItem> {
    if (!db) throw new Error("Database not available");
    // Check for recent duplicates (within last 5 seconds)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentItems = await db.select()
      .from(clipboardItems)
      .where(and(
        eq(clipboardItems.content, item.content),
        eq(clipboardItems.type, item.type || "text"),
        gt(clipboardItems.createdAt, fiveSecondsAgo),
        eq(clipboardItems.userId, userId)
      ));
    if (recentItems.length > 0) {
      return recentItems[0];
    }
    const [newItem] = await db.insert(clipboardItems).values({ ...item, userId }).returning();
    // Clean up old items beyond limit
    const allItems = await db.select().from(clipboardItems).where(eq(clipboardItems.userId, userId)).orderBy(desc(clipboardItems.createdAt));
    if (allItems.length > 100) {
      const toDelete = allItems.slice(100);
      for (const item of toDelete) {
        await db.delete(clipboardItems).where(eq(clipboardItems.id, item.id));
      }
    }
    return newItem;
  }

  async deleteClipboardItem(id: number, userId: string): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(clipboardItems).where(and(eq(clipboardItems.id, id), eq(clipboardItems.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async clearClipboardHistory(userId: string): Promise<void> {
    if (!db) throw new Error("Database not available");
    await db.delete(clipboardItems).where(eq(clipboardItems.userId, userId));
  }

  // Settings
  async getSettings(): Promise<Settings> {
    if (!db) throw new Error("Database not available");
    const [setting] = await db.select().from(settings).limit(1);
    if (!setting) {
      // Create default settings
      const [newSettings] = await db.insert(settings).values({
        snippetShortcut: "ctrl+;",
        clipboardShortcut: "ctrl+shift+v",
        clipboardEnabled: 1,
        historyLimit: 100,
        launchOnStartup: 0,
        theme: "light"
      }).returning();
      return newSettings;
    }
    return setting;
  }

  async updateSettings(updateData: Partial<InsertSettings>): Promise<Settings> {
    if (!db) throw new Error("Database not available");
    const currentSettings = await this.getSettings();
    const [updated] = await db.update(settings)
      .set(updateData)
      .where(eq(settings.id, currentSettings.id))
      .returning();
    return updated;
  }
}

// Use in-memory storage if DATABASE_URL is not available
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
