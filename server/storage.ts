import { 
  snippets, 
  clipboardItems, 
  settings,
  snippetsSQLite,
  clipboardItemsSQLite,
  settingsSQLite,
  type Snippet, 
  type InsertSnippet,
  type ClipboardItem,
  type InsertClipboardItem,
  type Settings,
  type InsertSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gt } from "drizzle-orm";
import fs from "fs";
import path from "path";

// Determine which schema to use based on database type
const isSQLite = db && db.dialect && db.dialect.name === 'sqlite';
const activeSnippets = isSQLite ? snippetsSQLite : snippets;
const activeClipboardItems = isSQLite ? clipboardItemsSQLite : clipboardItems;
const activeSettings = isSQLite ? settingsSQLite : settings;

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

// File-based storage for persistence across restarts
export class FileStorage implements IStorage {
  private dataDir: string;
  private snippetsFile: string;
  private clipboardFile: string;
  private settingsFile: string;
  private currentSnippetId: number;
  private currentClipboardId: number;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), "data");
    this.snippetsFile = path.join(this.dataDir, "snippets.json");
    this.clipboardFile = path.join(this.dataDir, "clipboard.json");
    this.settingsFile = path.join(this.dataDir, "settings.json");
    this.currentSnippetId = 1;
    this.currentClipboardId = 1;
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Initialize files if they don't exist
    this.initializeFiles();
  }

  private initializeFiles() {
    // Initialize snippets file
    if (!fs.existsSync(this.snippetsFile)) {
      fs.writeFileSync(this.snippetsFile, JSON.stringify([], null, 2));
    }

    // Initialize clipboard file
    if (!fs.existsSync(this.clipboardFile)) {
      fs.writeFileSync(this.clipboardFile, JSON.stringify([], null, 2));
    }

    // Initialize settings file
    if (!fs.existsSync(this.settingsFile)) {
      const defaultSettings = {
        id: 1,
        snippetShortcut: "ctrl+;",
        clipboardShortcut: "ctrl+shift+v",
        clipboardEnabled: 1,
        historyLimit: 100,
        launchOnStartup: 0,
        theme: "light"
      };
      fs.writeFileSync(this.settingsFile, JSON.stringify(defaultSettings, null, 2));
    }

    // Calculate next IDs
    this.calculateNextIds();
  }

  private calculateNextIds() {
    try {
      const snippets = this.readSnippets();
      const clipboardItems = this.readClipboardItems();
      
      this.currentSnippetId = snippets.length > 0 ? Math.max(...snippets.map(s => s.id)) + 1 : 1;
      this.currentClipboardId = clipboardItems.length > 0 ? Math.max(...clipboardItems.map(c => c.id)) + 1 : 1;
    } catch (error) {
      console.log("Error calculating next IDs, using defaults");
    }
  }

  private readSnippets(): Snippet[] {
    try {
      const data = fs.readFileSync(this.snippetsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private writeSnippets(snippets: Snippet[]) {
    fs.writeFileSync(this.snippetsFile, JSON.stringify(snippets, null, 2));
  }

  private readClipboardItems(): ClipboardItem[] {
    try {
      const data = fs.readFileSync(this.clipboardFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private writeClipboardItems(items: ClipboardItem[]) {
    fs.writeFileSync(this.clipboardFile, JSON.stringify(items, null, 2));
  }

  private readSettings(): Settings {
    try {
      const data = fs.readFileSync(this.settingsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {
        id: 1,
        snippetShortcut: "ctrl+;",
        clipboardShortcut: "ctrl+shift+v",
        clipboardEnabled: 1,
        historyLimit: 100,
        launchOnStartup: 0,
        theme: "light"
      };
    }
  }

  private writeSettings(settings: Settings) {
    fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
  }

  // Snippets
  async getSnippets(userId: string): Promise<Snippet[]> {
    const snippets = this.readSnippets();
    return snippets
      .filter(snippet => snippet.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getSnippet(id: number, userId: string): Promise<Snippet | undefined> {
    const snippets = this.readSnippets();
    return snippets.find(snippet => snippet.id === id && snippet.userId === userId);
  }

  async getSnippetByTrigger(trigger: string, userId: string): Promise<Snippet | undefined> {
    const snippets = this.readSnippets();
    return snippets.find(snippet => snippet.trigger === trigger && snippet.userId === userId);
  }

  async createSnippet(insertSnippet: InsertSnippet, userId: string): Promise<Snippet> {
    const snippets = this.readSnippets();
    const now = new Date();
    const snippet: Snippet = {
      ...insertSnippet,
      id: this.currentSnippetId++,
      userId,
      category: insertSnippet.category || null,
      description: insertSnippet.description || null,
      parentId: insertSnippet.parentId || null,
      createdAt: now,
      updatedAt: now,
    };
    
    snippets.push(snippet);
    this.writeSnippets(snippets);
    return snippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined> {
    const snippets = this.readSnippets();
    const index = snippets.findIndex(s => s.id === id && s.userId === userId);
    if (index === -1) return undefined;
    
    snippets[index] = {
      ...snippets[index],
      ...updateData,
      updatedAt: new Date(),
    };
    
    this.writeSnippets(snippets);
    return snippets[index];
  }

  async deleteSnippet(id: number, userId: string): Promise<boolean> {
    const snippets = this.readSnippets();
    const filteredSnippets = snippets.filter(s => !(s.id === id && s.userId === userId));
    
    if (filteredSnippets.length === snippets.length) {
      return false; // No snippet was deleted
    }
    
    this.writeSnippets(filteredSnippets);
    return true;
  }

  // Clipboard
  async getClipboardItems(userId: string): Promise<ClipboardItem[]> {
    const items = this.readClipboardItems();
    return items
      .filter(item => item.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createClipboardItem(insertItem: InsertClipboardItem, userId: string): Promise<ClipboardItem> {
    const items = this.readClipboardItems();
    
    // Check for recent duplicates (within last 5 seconds)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentItems = items.filter(item => 
      item.userId === userId &&
      item.content === insertItem.content &&
      item.type === (insertItem.type || "text") &&
      new Date(item.createdAt).getTime() > fiveSecondsAgo.getTime()
    );
    
    if (recentItems.length > 0) {
      return recentItems[0];
    }
    
    const item: ClipboardItem = {
      ...insertItem,
      id: this.currentClipboardId++,
      userId,
      type: insertItem.type || "text",
      createdAt: new Date(),
    };
    
    items.push(item);
    
    // Maintain history limit
    const userItems = items.filter(i => i.userId === userId);
    if (userItems.length > 100) {
      const toDelete = userItems.slice(100);
      const filteredItems = items.filter(i => !toDelete.some(d => d.id === i.id));
      this.writeClipboardItems(filteredItems);
    } else {
      this.writeClipboardItems(items);
    }
    
    return item;
  }

  async deleteClipboardItem(id: number, userId: string): Promise<boolean> {
    const items = this.readClipboardItems();
    const filteredItems = items.filter(item => !(item.id === id && item.userId === userId));
    
    if (filteredItems.length === items.length) {
      return false; // No item was deleted
    }
    
    this.writeClipboardItems(filteredItems);
    return true;
  }

  async clearClipboardHistory(userId: string): Promise<void> {
    const items = this.readClipboardItems();
    const filteredItems = items.filter(item => item.userId !== userId);
    this.writeClipboardItems(filteredItems);
  }

  // Settings
  async getSettings(): Promise<Settings> {
    return this.readSettings();
  }

  async updateSettings(settings: Partial<InsertSettings>): Promise<Settings> {
    const currentSettings = this.readSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    this.writeSettings(updatedSettings);
    return updatedSettings;
  }
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
    this.settings = {
      id: 1,
      snippetShortcut: "ctrl+;",
      clipboardShortcut: "ctrl+shift+v",
      clipboardEnabled: 1,
      historyLimit: 100,
      launchOnStartup: 0,
      theme: "light"
    };
    // No default snippets - users start with a clean slate
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
    return await db.select().from(activeSnippets).where(eq(activeSnippets.userId, userId)).orderBy(desc(activeSnippets.createdAt));
  }

  async getSnippet(id: number, userId: string): Promise<Snippet | undefined> {
    if (!db) throw new Error("Database not available");
    const [snippet] = await db.select().from(activeSnippets).where(and(eq(activeSnippets.id, id), eq(activeSnippets.userId, userId)));
    return snippet;
  }

  async getSnippetByTrigger(trigger: string, userId: string): Promise<Snippet | undefined> {
    if (!db) throw new Error("Database not available");
    const [snippet] = await db.select().from(activeSnippets).where(and(eq(activeSnippets.trigger, trigger), eq(activeSnippets.userId, userId)));
    return snippet;
  }

  async createSnippet(snippet: InsertSnippet, userId: string): Promise<Snippet> {
    if (!db) throw new Error("Database not available");
    const [newSnippet] = await db.insert(activeSnippets).values({
      ...snippet,
      userId,
      updatedAt: new Date()
    }).returning();
    return newSnippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined> {
    if (!db) throw new Error("Database not available");
    const [updated] = await db.update(activeSnippets)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(activeSnippets.id, id), eq(activeSnippets.userId, userId)))
      .returning();
    return updated;
  }

  async deleteSnippet(id: number, userId: string): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(activeSnippets).where(and(eq(activeSnippets.id, id), eq(activeSnippets.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Clipboard
  async getClipboardItems(userId: string): Promise<ClipboardItem[]> {
    if (!db) throw new Error("Database not available");
    return await db.select().from(activeClipboardItems).where(eq(activeClipboardItems.userId, userId)).orderBy(desc(activeClipboardItems.createdAt)).limit(100);
  }

  async createClipboardItem(item: InsertClipboardItem, userId: string): Promise<ClipboardItem> {
    if (!db) throw new Error("Database not available");
    // Check for recent duplicates (within last 5 seconds)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentItems = await db.select()
      .from(activeClipboardItems)
      .where(and(
        eq(activeClipboardItems.content, item.content),
        eq(activeClipboardItems.type, item.type || "text"),
        gt(activeClipboardItems.createdAt, fiveSecondsAgo),
        eq(activeClipboardItems.userId, userId)
      ));
    if (recentItems.length > 0) {
      return recentItems[0];
    }
    const [newItem] = await db.insert(activeClipboardItems).values({ ...item, userId }).returning();
    // Clean up old items beyond limit
    const allItems = await db.select().from(activeClipboardItems).where(eq(activeClipboardItems.userId, userId)).orderBy(desc(activeClipboardItems.createdAt));
    if (allItems.length > 100) {
      const toDelete = allItems.slice(100);
      for (const item of toDelete) {
        await db.delete(activeClipboardItems).where(eq(activeClipboardItems.id, item.id));
      }
    }
    return newItem;
  }

  async deleteClipboardItem(id: number, userId: string): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(activeClipboardItems).where(and(eq(activeClipboardItems.id, id), eq(activeClipboardItems.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async clearClipboardHistory(userId: string): Promise<void> {
    if (!db) throw new Error("Database not available");
    await db.delete(activeClipboardItems).where(eq(activeClipboardItems.userId, userId));
  }

  // Settings
  async getSettings(): Promise<Settings> {
    if (!db) throw new Error("Database not available");
    const [setting] = await db.select().from(activeSettings).limit(1);
    if (!setting) {
      // Create default settings
      const [newSettings] = await db.insert(activeSettings).values({
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
    const [updated] = await db.update(activeSettings)
      .set(updateData)
      .where(eq(activeSettings.id, currentSettings.id))
      .returning();
    return updated;
  }
}

// Use database storage if available (PostgreSQL or SQLite), otherwise use file storage for persistence
export const storage = db ? new DatabaseStorage() : new FileStorage();
