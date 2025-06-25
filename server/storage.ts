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
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Snippets
  getSnippets(): Promise<Snippet[]>;
  getSnippet(id: number): Promise<Snippet | undefined>;
  getSnippetByTrigger(trigger: string): Promise<Snippet | undefined>;
  createSnippet(snippet: InsertSnippet): Promise<Snippet>;
  updateSnippet(id: number, snippet: Partial<InsertSnippet>): Promise<Snippet | undefined>;
  deleteSnippet(id: number): Promise<boolean>;
  
  // Clipboard
  getClipboardItems(): Promise<ClipboardItem[]>;
  createClipboardItem(item: InsertClipboardItem): Promise<ClipboardItem>;
  deleteClipboardItem(id: number): Promise<boolean>;
  clearClipboardHistory(): Promise<void>;
  
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
    const defaultSnippets: InsertSnippet[] = [
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
        content: `Subject: Follow-up on our meeting

Hi [Name],

Thank you for taking the time to meet with me today. I wanted to follow up on our discussion about...

Best regards,
[Your Name]`,
        trigger: "email",
        category: "template",
        description: "Professional email template"
      }
    ];

    defaultSnippets.forEach(snippet => {
      const id = this.currentSnippetId++;
      const now = new Date();
      this.snippets.set(id, {
        ...snippet,
        id,
        category: snippet.category || null,
        description: snippet.description || null,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  async getSnippets(): Promise<Snippet[]> {
    return Array.from(this.snippets.values()).sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  async getSnippet(id: number): Promise<Snippet | undefined> {
    return this.snippets.get(id);
  }

  async getSnippetByTrigger(trigger: string): Promise<Snippet | undefined> {
    return Array.from(this.snippets.values()).find(
      snippet => snippet.trigger === trigger
    );
  }

  async createSnippet(insertSnippet: InsertSnippet): Promise<Snippet> {
    const id = this.currentSnippetId++;
    const now = new Date();
    const snippet: Snippet = {
      ...insertSnippet,
      id,
      category: insertSnippet.category || null,
      description: insertSnippet.description || null,
      createdAt: now,
      updatedAt: now,
    };
    this.snippets.set(id, snippet);
    return snippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>): Promise<Snippet | undefined> {
    const existing = this.snippets.get(id);
    if (!existing) return undefined;

    const updated: Snippet = {
      ...existing,
      ...updateData,
      updatedAt: new Date(),
    };
    this.snippets.set(id, updated);
    return updated;
  }

  async deleteSnippet(id: number): Promise<boolean> {
    return this.snippets.delete(id);
  }

  async getClipboardItems(): Promise<ClipboardItem[]> {
    return Array.from(this.clipboardItems.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async createClipboardItem(insertItem: InsertClipboardItem): Promise<ClipboardItem> {
    const id = this.currentClipboardId++;
    const item: ClipboardItem = {
      ...insertItem,
      id,
      type: insertItem.type || "text",
      createdAt: new Date(),
    };
    this.clipboardItems.set(id, item);

    // Maintain history limit
    const items = await this.getClipboardItems();
    if (items.length > this.settings.historyLimit) {
      const itemsToDelete = items.slice(this.settings.historyLimit);
      itemsToDelete.forEach(item => this.clipboardItems.delete(item.id));
    }

    return item;
  }

  async deleteClipboardItem(id: number): Promise<boolean> {
    return this.clipboardItems.delete(id);
  }

  async clearClipboardHistory(): Promise<void> {
    this.clipboardItems.clear();
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
  async getSnippets(): Promise<Snippet[]> {
    return await db.select().from(snippets).orderBy(desc(snippets.createdAt));
  }

  async getSnippet(id: number): Promise<Snippet | undefined> {
    const [snippet] = await db.select().from(snippets).where(eq(snippets.id, id));
    return snippet;
  }

  async getSnippetByTrigger(trigger: string): Promise<Snippet | undefined> {
    const [snippet] = await db.select().from(snippets).where(eq(snippets.trigger, trigger));
    return snippet;
  }

  async createSnippet(snippet: InsertSnippet): Promise<Snippet> {
    const [newSnippet] = await db.insert(snippets).values({
      ...snippet,
      updatedAt: new Date()
    }).returning();
    return newSnippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>): Promise<Snippet | undefined> {
    const [updated] = await db.update(snippets)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(snippets.id, id))
      .returning();
    return updated;
  }

  async deleteSnippet(id: number): Promise<boolean> {
    const result = await db.delete(snippets).where(eq(snippets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Clipboard
  async getClipboardItems(): Promise<ClipboardItem[]> {
    return await db.select().from(clipboardItems).orderBy(desc(clipboardItems.createdAt)).limit(100);
  }

  async createClipboardItem(item: InsertClipboardItem): Promise<ClipboardItem> {
    const [newItem] = await db.insert(clipboardItems).values(item).returning();
    
    // Clean up old items beyond limit
    const allItems = await db.select().from(clipboardItems).orderBy(desc(clipboardItems.createdAt));
    if (allItems.length > 100) {
      const toDelete = allItems.slice(100);
      for (const item of toDelete) {
        await db.delete(clipboardItems).where(eq(clipboardItems.id, item.id));
      }
    }
    
    return newItem;
  }

  async deleteClipboardItem(id: number): Promise<boolean> {
    const result = await db.delete(clipboardItems).where(eq(clipboardItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async clearClipboardHistory(): Promise<void> {
    await db.delete(clipboardItems);
  }

  // Settings
  async getSettings(): Promise<Settings> {
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
    const currentSettings = await this.getSettings();
    const [updated] = await db.update(settings)
      .set(updateData)
      .where(eq(settings.id, currentSettings.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
