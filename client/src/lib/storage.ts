export class LocalStorage {
  static set(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }

  static get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (error) {
      console.error("Failed to read from localStorage:", error);
      return defaultValue;
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to remove from localStorage:", error);
    }
  }

  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error("Failed to clear localStorage:", error);
    }
  }
}

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: "snipclip_settings",
  SNIPPETS: "snipclip_snippets",
  CLIPBOARD_HISTORY: "snipclip_clipboard_history",
  LAST_CLIPBOARD_CONTENT: "snipclip_last_clipboard",
} as const;
