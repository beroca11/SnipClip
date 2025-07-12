# Security Guide for SnipClip

## Overview

This document outlines the security measures implemented in SnipClip and provides guidance for secure deployment and operation.

## Security Improvements Implemented

### 1. Authentication System Security

#### Enhanced Session Management
- **Secure Session Tokens**: Using cryptographically secure random tokens (64-character hex)
- **Session Expiration**: Automatic session expiration after 24 hours
- **Session Limiting**: Maximum 5 concurrent sessions per user
- **Secure Session Storage**: Removed sensitive data (PIN/passphrase) from session storage

#### Rate Limiting
- **Login Attempts**: Limited to 5 attempts per 15-minute window per IP
- **Automatic Cleanup**: Expired rate limit entries are cleaned up automatically

#### Development Mode Security
- **Controlled Bypass**: Development authentication bypass requires explicit environment variable
- **Warning Logging**: Development bypasses are logged with security warnings
- **Production Enforcement**: No bypasses allowed in production mode

### 2. Input Validation and Sanitization

#### Enhanced Validation Schemas
- **Length Limits**: All inputs have appropriate maximum length limits
- **Character Filtering**: Control characters are stripped from inputs
- **Type Validation**: Strict type checking for all data types
- **Content Validation**: Regex patterns for structured data (triggers, shortcuts)

#### Specific Validations
- **Snippets**: Title (200 chars), Content (50K chars), Trigger (50 chars, alphanumeric only)
- **Folders**: Name (100 chars), prevents reserved "General" folder name
- **Clipboard**: Content (100K chars), type enum validation
- **Settings**: Shortcut format validation, theme enum validation

### 3. Security Headers and CORS

#### HTTP Security Headers
- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Restricts camera, microphone, geolocation, payment APIs

#### Content Security Policy (CSP)
- **Default Policy**: 'self' only
- **Script Sources**: Limited to self with necessary unsafe-inline for development
- **Style Sources**: Limited to self with unsafe-inline for CSS-in-JS
- **Image Sources**: Self, data URIs, and blob URLs only
- **Connect Sources**: Self and WebSocket connections only

#### CORS Configuration
- **Origin Whitelist**: Only allows specific trusted origins
- **Credentials Support**: Properly configured for session cookies
- **Preflight Handling**: Proper OPTIONS request handling

### 4. Error Handling and Information Disclosure

#### Secure Error Messages
- **Production Mode**: Generic error messages to prevent information disclosure
- **Development Mode**: Detailed errors for debugging
- **Validation Errors**: Sanitized validation messages
- **Security Event Logging**: Comprehensive logging of security events

#### Request Logging
- **Sensitive Data Redaction**: Session tokens and user IDs are redacted from logs
- **Performance Tracking**: Request timing and status logging
- **Security Events**: Login attempts, authentication failures, and suspicious activity

### 5. Database Security

#### Connection Security
- **SSL/TLS**: Enforced SSL connections in production
- **Connection Pooling**: Proper connection pool configuration
- **Error Handling**: Database connection errors are logged and handled gracefully
- **Environment Validation**: Database URL format validation

#### Query Security
- **ORM Usage**: Drizzle ORM provides SQL injection protection
- **Parameter Binding**: All queries use parameterized statements
- **User Isolation**: All data is isolated by user ID
- **Input Validation**: All inputs are validated before database operations

### 6. Environment and Configuration Security

#### Environment Variables
- **Validation**: Required environment variables are validated on startup
- **Format Checking**: Database URLs and secrets are format-validated
- **Security Warnings**: Warnings for weak or missing security configurations

#### Secrets Management
- **Session Secrets**: Configurable session secret with minimum length requirements
- **Database Credentials**: Secure database connection string handling
- **Development Flags**: Explicit flags for development-only features

## Security Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the project root:

```bash
# Required for production
NODE_ENV=production
SESSION_SECRET=your-secure-session-secret-here-minimum-32-characters
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Optional
PORT=5001
```

### 2. Generate Secure Session Secret

```bash
# Generate a secure session secret
openssl rand -hex 32
```

### 3. Database Security

For PostgreSQL (recommended):
```bash
# Use SSL connections
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# For Neon Database
DATABASE_URL=postgresql://user:pass@ep-example.region.aws.neon.tech/db?sslmode=require
```

### 4. File Permissions

```bash
# Secure the .env file
chmod 600 .env

# Verify the file is not world-readable
ls -la .env
```

### 5. Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate and set secure `SESSION_SECRET` (32+ characters)
- [ ] Configure secure database connection with SSL
- [ ] Remove or disable `ALLOW_DEV_BYPASS`
- [ ] Set proper file permissions on `.env`
- [ ] Enable HTTPS/TLS at load balancer/proxy level
- [ ] Configure monitoring and alerting
- [ ] Regular security updates and patches

## Security Best Practices

### 1. Development
- Never commit `.env` files to version control
- Use different secrets for development and production
- Test with production-like security settings
- Keep development bypass disabled in production

### 2. Production
- Use environment variables or secrets management systems
- Enable comprehensive logging and monitoring
- Implement rate limiting at multiple levels
- Regular security audits and updates
- Use HTTPS for all communications

### 3. Database
- Use connection pooling
- Enable SSL/TLS connections
- Regular backups and security patches
- Monitor for unusual access patterns
- Use least-privilege database users

### 4. Monitoring
- Monitor failed login attempts
- Track authentication bypasses
- Alert on unusual session patterns
- Log security events with proper context
- Regular security log reviews

## Incident Response

### 1. Security Event Detection
- Monitor logs for security events
- Set up alerts for suspicious activities
- Track authentication failures and rate limit violations

### 2. Response Procedures
- Immediate session invalidation for compromised accounts
- IP blocking for persistent attacks
- Database connection monitoring
- Escalation procedures for security incidents

### 3. Recovery
- Session cleanup and regeneration
- Database integrity verification
- Security configuration review
- Incident documentation and lessons learned

## Security Updates

This security guide should be reviewed and updated regularly, especially:
- After security incidents
- When new features are added
- During security audits
- When upgrading dependencies
- At least quarterly for general review

## Contact

For security concerns or questions, please refer to the project's security policy and contact information in the repository. 