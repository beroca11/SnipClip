import crypto from 'crypto';
import { db } from './db';
import { sql } from 'drizzle-orm';

// Ensure consistent SESSION_SECRET across environments
const SESSION_SECRET = process.env.SESSION_SECRET || "SnipClip_Sync_v1_default_DO_NOT_USE_IN_PRODUCTION";

// Warn if using default secret in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn('WARNING: Using default SESSION_SECRET in production. This is insecure and will cause user ID inconsistencies.');
  console.warn('Please set the SESSION_SECRET environment variable to a secure random string.');
}

export interface UserCredentials {
  pin: string;
  passphrase: string;
}

export interface UserSession {
  userId: string;
  createdAt: number;
  expiresAt: number;
  // Removed pin and passphrase from session storage for security
}

// Generate a consistent user ID from PIN and passphrase
export function generateUserId(pin: string, passphrase: string): string {
  // Combine PIN and passphrase with a consistent salt
  const combined = `${pin}:${passphrase}:${SESSION_SECRET}`;
  
  // Create a SHA-256 hash
  const hash = crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
  
  // Return first 32 characters for a shorter but still unique ID
  return hash.substring(0, 32);
}

// Enhanced user ID resolution that handles SESSION_SECRET changes
export async function resolveUserId(pin: string, passphrase: string): Promise<string> {
  // First, try to generate the current user ID
  const currentUserId = generateUserId(pin, passphrase);
  
  // Check if this user ID exists in the database
  const userExists = await checkUserExists(currentUserId);
  if (userExists) {
    return currentUserId;
  }
  
  // Check if there's a mapping for this PIN/passphrase combination
  const mappedUserId = await findUserMapping(pin, passphrase);
  if (mappedUserId) {
    console.log(`User ID resolution: Using mapped user ID ${mappedUserId} for PIN/passphrase combination`);
    return mappedUserId;
  }
  
  // If no mapping exists, check if there are any users with data
  // that might be the same user with a different ID (due to SESSION_SECRET change)
  const existingUsers = await findUsersWithData();
  
  // For now, if there's only one user with significant data, assume it's the same user
  // This is a simple heuristic - in a real system you might want more sophisticated logic
  if (existingUsers.length === 1) {
    console.log(`User ID resolution: Using existing user ${existingUsers[0].userId} for PIN/passphrase combination`);
    return existingUsers[0].userId;
  }
  
  // If multiple users exist, we can't automatically determine which one to use
  // Return the current generated ID and let the application handle it
  console.log(`User ID resolution: Multiple users found, using generated ID ${currentUserId}`);
  return currentUserId;
}

// Check if a user ID exists in the database
async function checkUserExists(userId: string): Promise<boolean> {
  try {
    if (!db) return false;
    
    // Check if user has any data in any table
    const result = await db.execute(sql`
      SELECT 1 FROM (
        SELECT user_id FROM snippets WHERE user_id = ${userId}
        UNION
        SELECT user_id FROM folders WHERE user_id = ${userId}
        UNION
        SELECT user_id FROM clipboard_items WHERE user_id = ${userId}
      ) AS user_data LIMIT 1
    `);
    
    return result?.rows && result.rows.length > 0;
  } catch (error) {
    console.error('Error checking user existence:', error);
    return false;
  }
}

// Find users with data in the database
async function findUsersWithData(): Promise<Array<{userId: string, dataCount: number}>> {
  try {
    if (!db) return [];
    
    const result = await db.execute(sql`
      SELECT user_id, COUNT(*) as data_count FROM (
        SELECT user_id FROM snippets
        UNION ALL
        SELECT user_id FROM folders
        UNION ALL
        SELECT user_id FROM clipboard_items
      ) AS all_data
      GROUP BY user_id
      ORDER BY data_count DESC
    `);
    
    return result?.rows?.map((row: any) => ({
      userId: row.user_id,
      dataCount: parseInt(row.data_count)
    })) || [];
  } catch (error) {
    console.error('Error finding users with data:', error);
    return [];
  }
}

// Find user mapping for PIN/passphrase combination
async function findUserMapping(pin: string, passphrase: string): Promise<string | null> {
  try {
    if (!db) return null;
    
    // Create a hash of the passphrase for security
    const passphraseHash = crypto.createHash('sha256').update(passphrase, 'utf8').digest('hex');
    
    const result = await db.execute(sql`
      SELECT user_id FROM user_mappings 
      WHERE pin = ${pin} AND passphrase_hash = ${passphraseHash}
      LIMIT 1
    `);
    
    return result?.rows?.[0]?.user_id || null;
  } catch (error) {
    console.error('Error finding user mapping:', error);
    return null;
  }
}

// Create or update user mapping
export async function createUserMapping(pin: string, passphrase: string, userId: string): Promise<boolean> {
  try {
    if (!db) return false;
    
    // Create a hash of the passphrase for security
    const passphraseHash = crypto.createHash('sha256').update(passphrase, 'utf8').digest('hex');
    
    await db.execute(sql`
      INSERT INTO user_mappings (pin, passphrase_hash, user_id, created_at, updated_at)
      VALUES (${pin}, ${passphraseHash}, ${userId}, NOW(), NOW())
      ON CONFLICT (pin, passphrase_hash) 
      DO UPDATE SET user_id = ${userId}, updated_at = NOW()
    `);
    
    return true;
  } catch (error) {
    console.error('Error creating user mapping:', error);
    return false;
  }
}

// Validate PIN format (4-6 digits)
export function validatePin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

// Validate passphrase (minimum 8 characters, alphanumeric + special chars)
export function validatePassphrase(passphrase: string): boolean {
  return passphrase.length >= 8 && 
         passphrase.length <= 256 && // Add maximum length
         /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(passphrase);
}

// Create a cryptographically secure session token
export function createSessionToken(): string {
  // Use crypto.randomBytes for secure random token generation
  return crypto.randomBytes(32).toString('hex');
}

// Session configuration
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_SESSIONS_PER_USER = 5; // Limit concurrent sessions

// In-memory session store (for development - should use Redis/database in production)
const sessions = new Map<string, UserSession>();
const userSessions = new Map<string, Set<string>>(); // Track sessions per user

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

export function createSession(userId: string): string {
  const token = createSessionToken();
  const now = Date.now();
  const session: UserSession = {
    userId,
    createdAt: now,
    expiresAt: now + SESSION_DURATION
  };
  
  sessions.set(token, session);
  
  // Track sessions per user
  if (!userSessions.has(userId)) {
    userSessions.set(userId, new Set());
  }
  
  const userSessionSet = userSessions.get(userId)!;
  userSessionSet.add(token);
  
  // Limit concurrent sessions per user
  if (userSessionSet.size > MAX_SESSIONS_PER_USER) {
    const oldestSessions = Array.from(userSessionSet).slice(0, userSessionSet.size - MAX_SESSIONS_PER_USER);
    oldestSessions.forEach(oldToken => {
      sessions.delete(oldToken);
      userSessionSet.delete(oldToken);
    });
  }
  
  return token;
}

export function getSession(token: string): UserSession | undefined {
  if (!token) return undefined;
  
  const session = sessions.get(token);
  if (!session) return undefined;
  
  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    removeSession(token);
    return undefined;
  }
  
  return session;
}

export function removeSession(token: string): boolean {
  const session = sessions.get(token);
  if (session) {
    const userSessionSet = userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(token);
      if (userSessionSet.size === 0) {
        userSessions.delete(session.userId);
      }
    }
  }
  
  return sessions.delete(token);
}

// Remove all sessions for a user (useful for logout all devices)
export function removeAllUserSessions(userId: string): void {
  const userSessionSet = userSessions.get(userId);
  if (userSessionSet) {
    userSessionSet.forEach(token => sessions.delete(token));
    userSessions.delete(userId);
  }
}

// Secure authentication function
export function authenticateUser(sessionToken?: string, userId?: string): string | null {
  // Always require session token in production
  if (!isDevelopment) {
    if (!sessionToken) return null;
    
    const session = getSession(sessionToken);
    if (!session) return null;
    
    return session.userId;
  }
  
  // In development mode, still prefer session token but allow fallback
  if (sessionToken) {
    const session = getSession(sessionToken);
    if (session) {
      return session.userId;
    }
  }
  
  // Development fallback - but only if explicitly enabled
  if (isDevelopment && userId && process.env.ALLOW_DEV_BYPASS === 'true') {
    console.warn('Development mode: Allowing userId fallback authentication - THIS SHOULD NOT BE USED IN PRODUCTION');
    return userId;
  }
  
  return null;
}

// Clean up expired sessions
export function cleanupSessions(): void {
  const now = Date.now();
  const expiredTokens: string[] = [];
  
  sessions.forEach((session, token) => {
    if (now > session.expiresAt) {
      expiredTokens.push(token);
    }
  });
  
  expiredTokens.forEach(token => removeSession(token));
  
  if (expiredTokens.length > 0) {
    console.log(`Cleaned up ${expiredTokens.length} expired sessions`);
  }
}

// Validate session token format
export function isValidSessionToken(token: string): boolean {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
}

// Run cleanup every hour
setInterval(cleanupSessions, 60 * 60 * 1000);

// Run initial cleanup
cleanupSessions(); 