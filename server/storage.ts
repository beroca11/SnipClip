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
  type InsertSettings,
  folders,
  foldersSQLite
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
  getSnippets(userId: string, folderId?: number): Promise<Snippet[]>;
  getSnippet(id: number, userId: string): Promise<Snippet | undefined>;
  getSnippetByTrigger(trigger: string, userId: string): Promise<Snippet | undefined>;
  createSnippet(snippet: InsertSnippet, userId: string): Promise<Snippet>;
  updateSnippet(id: number, snippet: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined>;
  deleteSnippet(id: number, userId: string): Promise<boolean>;
  
  // Folders
  getFolders(userId: string): Promise<any[]>;
  getFolder(id: number, userId: string): Promise<any | undefined>;
  createFolder(name: string, userId: string): Promise<any>;
  updateFolder(id: number, name: string, userId: string, sortOrder?: number): Promise<any | undefined>;
  deleteFolder(id: number, userId: string): Promise<boolean>;
  ensureGeneralFolder(userId: string): Promise<any>;
  
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
  private foldersFile: string;
  private currentSnippetId: number;
  private currentClipboardId: number;
  private currentFolderId: number;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), "data");
    this.snippetsFile = path.join(this.dataDir, "snippets.json");
    this.clipboardFile = path.join(this.dataDir, "clipboard.json");
    this.settingsFile = path.join(this.dataDir, "settings.json");
    this.foldersFile = path.join(this.dataDir, "folders.json");
    this.currentSnippetId = 1;
    this.currentClipboardId = 1;
    this.currentFolderId = 1;
    
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

    // Initialize folders file
    if (!fs.existsSync(this.foldersFile)) {
      fs.writeFileSync(this.foldersFile, JSON.stringify([], null, 2));
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
      const folders = this.readFolders();
      
      this.currentSnippetId = snippets.length > 0 ? Math.max(...snippets.map(s => s.id)) + 1 : 1;
      this.currentClipboardId = clipboardItems.length > 0 ? Math.max(...clipboardItems.map(c => c.id)) + 1 : 1;
      this.currentFolderId = folders.length > 0 ? Math.max(...folders.map(f => f.id)) + 1 : 1;
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

  private readFolders(): any[] {
    try {
      const data = fs.readFileSync(this.foldersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private writeFolders(folders: any[]) {
    fs.writeFileSync(this.foldersFile, JSON.stringify(folders, null, 2));
  }

  // Snippets
  async getSnippets(userId: string, folderId?: number): Promise<Snippet[]> {
    const snippets = this.readSnippets();
    return snippets
      .filter(snippet => snippet.userId === userId && (folderId ? snippet.folderId === folderId : true))
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
    // Validate that the folder exists if folderId is provided
    if (insertSnippet.folderId) {
      const folder = await this.getFolder(insertSnippet.folderId, userId);
      if (!folder) {
        throw new Error(`Cannot create snippet: Folder with ID ${insertSnippet.folderId} does not exist. Please select a valid folder or create the folder first.`);
      }
    }
    
    const snippets = this.readSnippets();
    const now = new Date();
    const snippet: Snippet = {
      ...insertSnippet,
      id: this.currentSnippetId++,
      userId,
      description: insertSnippet.description || null,
      folderId: typeof insertSnippet.folderId !== 'undefined' ? insertSnippet.folderId : null,
      createdAt: now,
      updatedAt: now,
    };
    
    snippets.push(snippet);
    this.writeSnippets(snippets);
    return snippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined> {
    // Validate that the folder exists if folderId is being updated
    if (updateData.folderId) {
      const folder = await this.getFolder(updateData.folderId, userId);
      if (!folder) {
        throw new Error(`Cannot update snippet: Folder with ID ${updateData.folderId} does not exist. Please select a valid folder or create the folder first.`);
      }
    }
    
    const snippets = this.readSnippets();
    const index = snippets.findIndex(s => s.id === id && s.userId === userId);
    if (index === -1) return undefined;
    const now = new Date();
    const updated: Snippet = {
      ...snippets[index],
      ...updateData,
      folderId: typeof updateData.folderId !== 'undefined' ? updateData.folderId : snippets[index].folderId ?? null,
      updatedAt: now,
    };
    snippets[index] = updated;
    this.writeSnippets(snippets);
    return updated;
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

  // Folders
  async getFolders(userId: string): Promise<any[]> {
    const folders = this.readFolders();
    return folders
      .filter(folder => folder.userId === userId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getFolder(id: number, userId: string): Promise<any | undefined> {
    const folders = this.readFolders();
    return folders.find(folder => folder.id === id && folder.userId === userId);
  }

  async createFolder(name: string, userId: string): Promise<any> {
    const folders = this.readFolders();
    
    // Check if folder name already exists for this user
    const existingFolder = folders.find(folder => folder.name === name && folder.userId === userId);
    if (existingFolder) {
      throw new Error("Folder name already exists for this user");
    }
    
    const now = new Date();
    const folder = {
      id: this.currentFolderId++,
      name,
      userId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    folders.push(folder);
    this.writeFolders(folders);
    return folder;
  }

  async updateFolder(id: number, name: string, userId: string): Promise<any | undefined> {
    const folders = this.readFolders();
    const folderIndex = folders.findIndex(folder => folder.id === id && folder.userId === userId);
    
    if (folderIndex === -1) {
      return undefined;
    }
    
    // Check if new name already exists for this user (excluding current folder)
    const existingFolder = folders.find(folder => folder.name === name && folder.userId === userId && folder.id !== id);
    if (existingFolder) {
      throw new Error("Folder name already exists for this user");
    }
    
    const now = new Date();
    folders[folderIndex] = {
      ...folders[folderIndex],
      name,
      updatedAt: now,
    };
    
    this.writeFolders(folders);
    return folders[folderIndex];
  }

  async deleteFolder(id: number, userId: string): Promise<boolean> {
    const folders = this.readFolders();
    const folderIndex = folders.findIndex(folder => folder.id === id && folder.userId === userId);
    
    if (folderIndex === -1) {
      return false;
    }
    
    // Move all snippets from this folder to no folder (set folderId to null)
    const snippets = this.readSnippets();
    const updatedSnippets = snippets.map(snippet => 
      snippet.folderId === id && snippet.userId === userId 
        ? { ...snippet, folderId: null }
        : snippet
    );
    this.writeSnippets(updatedSnippets);
    
    // Remove the folder
    folders.splice(folderIndex, 1);
    this.writeFolders(folders);
    
    return true;
  }

  async ensureGeneralFolder(userId: string): Promise<any> {
    const folders = this.readFolders();
    
    // Check if General folder already exists for this user
    const existingFolder = folders.find(folder => folder.name === "General" && folder.userId === userId);
    if (existingFolder) {
      return existingFolder;
    }
    
    // Create General folder if it doesn't exist
    const now = new Date();
    const generalFolder = {
      id: this.currentFolderId++,
      name: "General",
      userId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    folders.push(generalFolder);
    this.writeFolders(folders);
    return generalFolder;
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
  private folders: Map<number, any>;
  private settings: Settings;
  private currentSnippetId: number;
  private currentClipboardId: number;
  private currentFolderId: number;

  constructor() {
    this.snippets = new Map();
    this.clipboardItems = new Map();
    this.folders = new Map();
    this.currentSnippetId = 1;
    this.currentClipboardId = 1;
    this.currentFolderId = 1;
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

  async getSnippets(userId: string, folderId?: number): Promise<Snippet[]> {
    return Array.from(this.snippets.values())
      .filter(snippet => snippet.userId === userId && (folderId ? snippet.folderId === folderId : true))
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
    // Validate that the folder exists if folderId is provided
    if (insertSnippet.folderId) {
      const folder = await this.getFolder(insertSnippet.folderId, userId);
      if (!folder) {
        throw new Error(`Cannot create snippet: Folder with ID ${insertSnippet.folderId} does not exist. Please select a valid folder or create the folder first.`);
      }
    }
    
    const id = this.currentSnippetId++;
    const now = new Date();
    const snippet: Snippet = {
      ...insertSnippet,
      id,
      userId,
      description: insertSnippet.description || null,
      folderId: typeof insertSnippet.folderId !== 'undefined' ? insertSnippet.folderId : null,
      createdAt: now,
      updatedAt: now,
    };
    this.snippets.set(id, snippet);
    return snippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined> {
    // Validate that the folder exists if folderId is being updated
    if (updateData.folderId) {
      const folder = await this.getFolder(updateData.folderId, userId);
      if (!folder) {
        throw new Error(`Cannot update snippet: Folder with ID ${updateData.folderId} does not exist. Please select a valid folder or create the folder first.`);
      }
    }
    
    const existing = this.snippets.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: Snippet = {
      ...existing,
      ...updateData,
      folderId: typeof updateData.folderId !== 'undefined' ? updateData.folderId : existing.folderId ?? null,
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

  // Folders
  async getFolders(userId: string): Promise<any[]> {
    return Array.from(this.folders.values())
      .filter(folder => folder.userId === userId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getFolder(id: number, userId: string): Promise<any | undefined> {
    const folder = this.folders.get(id);
    return folder && folder.userId === userId ? folder : undefined;
  }

  async createFolder(name: string, userId: string): Promise<any> {
    // Check if folder name already exists for this user
    const existingFolder = Array.from(this.folders.values())
      .find(folder => folder.name === name && folder.userId === userId);
    if (existingFolder) {
      throw new Error("Folder name already exists for this user");
    }
    
    const now = new Date();
    const folder = {
      id: this.currentFolderId++,
      name,
      userId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    this.folders.set(folder.id, folder);
    return folder;
  }

  async updateFolder(id: number, name: string, userId: string): Promise<any | undefined> {
    const folder = this.folders.get(id);
    if (!folder || folder.userId !== userId) {
      return undefined;
    }
    
    // Check if new name already exists for this user (excluding current folder)
    const existingFolder = Array.from(this.folders.values())
      .find(f => f.name === name && f.userId === userId && f.id !== id);
    if (existingFolder) {
      throw new Error("Folder name already exists for this user");
    }
    
    const now = new Date();
    const updatedFolder = {
      ...folder,
      name,
      updatedAt: now,
    };
    
    this.folders.set(id, updatedFolder);
    return updatedFolder;
  }

  async deleteFolder(id: number, userId: string): Promise<boolean> {
    const folder = this.folders.get(id);
    if (!folder || folder.userId !== userId) {
      return false;
    }
    
    // Move all snippets from this folder to no folder (set folderId to null)
    Array.from(this.snippets.values())
      .filter(snippet => snippet.folderId === id && snippet.userId === userId)
      .forEach(snippet => {
        this.snippets.set(snippet.id, { ...snippet, folderId: null });
      });
    
    // Remove the folder
    return this.folders.delete(id);
  }

  async ensureGeneralFolder(userId: string): Promise<any> {
    // Check if General folder already exists for this user
    const existingFolder = Array.from(this.folders.values())
      .find(folder => folder.name === "General" && folder.userId === userId);
    
    if (existingFolder) {
      return existingFolder;
    }
    
    // Create General folder if it doesn't exist
    const now = new Date();
    const generalFolder = {
      id: this.currentFolderId++,
      name: "General",
      userId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    
    this.folders.set(generalFolder.id, generalFolder);
    return generalFolder;
  }

  // Clipboard
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

  // Settings
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
  async getSnippets(userId: string, folderId?: number): Promise<Snippet[]> {
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
    
    // Validate that the folder exists if folderId is provided
    if (snippet.folderId) {
      const folder = await this.getFolder(snippet.folderId, userId);
      if (!folder) {
        throw new Error(`Cannot create snippet: Folder with ID ${snippet.folderId} does not exist. Please select a valid folder or create the folder first.`);
      }
    }
    
    const [newSnippet] = await db.insert(activeSnippets).values({
      ...snippet,
      userId,
      updatedAt: new Date()
    }).returning();
    return newSnippet;
  }

  async updateSnippet(id: number, updateData: Partial<InsertSnippet>, userId: string): Promise<Snippet | undefined> {
    if (!db) throw new Error("Database not available");
    
    // Validate that the folder exists if folderId is being updated
    if (updateData.folderId) {
      const folder = await this.getFolder(updateData.folderId, userId);
      if (!folder) {
        throw new Error(`Cannot update snippet: Folder with ID ${updateData.folderId} does not exist. Please select a valid folder or create the folder first.`);
      }
    }
    
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

  // Folders
  async getFolders(userId: string): Promise<any[]> {
    if (!db) throw new Error("Database not available");
    const activeFolders = isSQLite ? foldersSQLite : folders;
    return await db.select().from(activeFolders).where(eq(activeFolders.userId, userId)).orderBy(activeFolders.sortOrder);
  }

  async getFolder(id: number, userId: string): Promise<any | undefined> {
    if (!db) throw new Error("Database not available");
    const activeFolders = isSQLite ? foldersSQLite : folders;
    const result = await db.select().from(activeFolders).where(and(eq(activeFolders.id, id), eq(activeFolders.userId, userId)));
    return result[0];
  }

  async createFolder(name: string, userId: string): Promise<any> {
    if (!db) throw new Error("Database not available");
    const activeFolders = isSQLite ? foldersSQLite : folders;
    const now = new Date();
    // Create folder with userId to make it user-specific
    const [folder] = await db.insert(activeFolders).values({ 
      name, 
      userId, 
      sortOrder: 0, 
      createdAt: now, 
      updatedAt: now 
    }).returning();
    return folder;
  }

  async updateFolder(id: number, name: string, userId: string, sortOrder?: number): Promise<any | undefined> {
    if (!db) throw new Error("Database not available");
    const activeFolders = isSQLite ? foldersSQLite : folders;
    const now = new Date();
    // Allow updating name and sortOrder, but only for the specific user's folder
    const updateData: any = { name, updatedAt: now };
    if (typeof sortOrder !== 'undefined') updateData.sortOrder = sortOrder;
    const [folder] = await db.update(activeFolders)
      .set(updateData)
      .where(and(eq(activeFolders.id, id), eq(activeFolders.userId, userId)))
      .returning();
    return folder;
  }

  async deleteFolder(id: number, userId: string): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const activeFolders = isSQLite ? foldersSQLite : folders;
    const activeSnippets = isSQLite ? snippetsSQLite : snippets;
    
    // First, move all snippets from this folder to no folder (set folderId to null)
    await db.update(activeSnippets)
      .set({ folderId: null })
      .where(and(eq(activeSnippets.folderId, id), eq(activeSnippets.userId, userId)));
    
    // Then delete the folder (only if it belongs to the user)
    const result = await db.delete(activeFolders)
      .where(and(eq(activeFolders.id, id), eq(activeFolders.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async ensureGeneralFolder(userId: string): Promise<any> {
    if (!db) throw new Error("Database not available");
    const activeFolders = isSQLite ? foldersSQLite : folders;
    
    // Check if General folder already exists for this user
    const [existingFolder] = await db.select()
      .from(activeFolders)
      .where(and(eq(activeFolders.name, "General"), eq(activeFolders.userId, userId)));
    
    if (existingFolder) {
      return existingFolder;
    }
    
    // Create General folder if it doesn't exist
    const now = new Date();
    const [generalFolder] = await db.insert(activeFolders).values({
      name: "General",
      userId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return generalFolder;
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
