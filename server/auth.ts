import crypto from 'crypto';

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