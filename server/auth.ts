import crypto from 'crypto';

export interface UserCredentials {
  pin: string;
  passphrase: string;
}

export interface UserSession {
  userId: string;
  pin: string;
  passphrase: string;
}

// Generate a consistent user ID from PIN and passphrase
export function generateUserId(pin: string, passphrase: string): string {
  // Combine PIN and passphrase with a salt for security
  const salt = "SnipClip_Sync_v1"; // Version-specific salt
  const combined = `${pin}:${passphrase}:${salt}`;
  
  // Create a SHA-256 hash
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  
  // Return first 32 characters for a shorter but still unique ID
  return hash.substring(0, 32);
}

// Validate PIN format (4-6 digits)
export function validatePin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

// Validate passphrase (minimum 8 characters, alphanumeric + special chars)
export function validatePassphrase(passphrase: string): boolean {
  return passphrase.length >= 8 && /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(passphrase);
}

// Create a session token for the user
export function createSessionToken(userId: string, pin: string, passphrase: string): string {
  const sessionData = `${userId}:${pin}:${passphrase}:${Date.now()}`;
  return crypto.createHash('sha256').update(sessionData).digest('hex');
}

// Verify session token
export function verifySessionToken(token: string, userId: string, pin: string, passphrase: string): boolean {
  const expectedToken = createSessionToken(userId, pin, passphrase);
  return token === expectedToken;
}

// In-memory session store (for development)
const sessions = new Map<string, UserSession>();

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

export function createSession(userId: string, pin: string, passphrase: string): string {
  const token = createSessionToken(userId, pin, passphrase);
  sessions.set(token, { userId, pin, passphrase });
  return token;
}

export function getSession(token: string): UserSession | undefined {
  return sessions.get(token);
}

export function removeSession(token: string): boolean {
  return sessions.delete(token);
}

// Enhanced authentication function that's more lenient in development
export function authenticateUser(sessionToken?: string, userId?: string): string | null {
  // In development mode, allow fallback to userId only
  if (isDevelopment && userId) {
    return userId;
  }
  
  // Check session token
  if (sessionToken) {
    const session = getSession(sessionToken);
    if (session) {
      return session.userId;
    }
  }
  
  // In development mode, if no valid session but userId is provided, allow it
  if (isDevelopment && userId) {
    console.log('Development mode: Allowing userId fallback authentication');
    return userId;
  }
  
  return null;
}

// Clean up old sessions (older than 24 hours)
export function cleanupSessions(): void {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  const tokensToDelete: string[] = [];
  
  sessions.forEach((session, token) => {
    // Extract timestamp from token (last part after the last colon)
    const parts = token.split(':');
    if (parts.length > 0) {
      const timestamp = parseInt(parts[parts.length - 1]);
      if (now - timestamp > oneDay) {
        tokensToDelete.push(token);
      }
    }
  });
  
  // Delete expired sessions
  tokensToDelete.forEach(token => sessions.delete(token));
}

// Run cleanup every hour
setInterval(cleanupSessions, 60 * 60 * 1000); 