# SnipClip - Text Snippet & Clipboard Manager

## Overview

SnipClip is a full-stack web application that serves as a productivity tool for managing text snippets and clipboard history. The application allows users to create, organize, and quickly access text snippets through keyboard shortcuts, while also maintaining a history of clipboard items for easy retrieval.

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server components:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript throughout the stack
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **API**: RESTful endpoints with JSON communication
- **Session Management**: Express sessions with PostgreSQL store

### Development Environment
- **Platform**: Replit with Node.js 20, Web, and PostgreSQL 16 modules
- **Hot Reload**: Vite development server with HMR
- **Error Handling**: Runtime error overlay for development
- **Build Process**: TypeScript compilation with esbuild for server bundling

## Key Components

### Database Schema (shared/schema.ts)
Three main entities with proper relationships:

1. **Snippets Table**
   - Stores reusable text snippets with triggers for quick access
   - Fields: id, title, content, trigger (unique), category, description, timestamps
   - Unique constraint on trigger field to prevent conflicts

2. **Clipboard Items Table**
   - Maintains history of clipboard content with type classification
   - Fields: id, content, type (text/url/code), createdAt
   - Automatic content type detection based on patterns

3. **Settings Table**
   - User configuration for shortcuts and application behavior
   - Fields: shortcuts for snippets/clipboard, clipboard monitoring toggle, history limits, startup preferences, theme

### Storage Layer (server/storage.ts)
- **Interface-based Design**: IStorage interface defines all data operations
- **In-Memory Implementation**: MemStorage class for development/testing
- **Database Operations**: Full CRUD operations for all entities
- **Type Safety**: Leverages Drizzle schema types throughout

### API Layer (server/routes.ts)
RESTful endpoints for all major operations:
- **Snippets**: GET, POST, PUT, DELETE with validation
- **Clipboard**: GET, POST, DELETE with bulk operations
- **Settings**: GET, PUT for user preferences
- **Validation**: Zod schemas for request validation
- **Error Handling**: Structured error responses with proper HTTP codes

### Frontend Components

#### Core Features
- **Snippet Manager**: Modal interface for browsing and selecting snippets
- **Snippet Editor**: Form-based creation and editing of snippets
- **Clipboard History**: Interface for viewing and managing clipboard items
- **Settings Modal**: Configuration interface for user preferences

#### UI System
- **Design System**: Consistent theming with CSS custom properties
- **Component Library**: Comprehensive set of reusable UI components
- **Responsive Design**: Mobile-first approach with responsive breakpoints
- **Accessibility**: ARIA compliance through Radix UI primitives

### Custom Hooks

#### Keyboard Shortcuts (use-keyboard-shortcuts.tsx)
- **Dynamic Configuration**: Reads shortcuts from user settings
- **Multi-key Combinations**: Supports Ctrl, Shift, Alt modifiers
- **Event Handling**: Global keyboard event listeners with proper cleanup

#### Clipboard Monitoring (use-clipboard-monitor.tsx)
- **Background Monitoring**: Continuous clipboard content detection
- **Content Classification**: Automatic type detection (text, URL, code)
- **Permission Handling**: Graceful degradation when clipboard access unavailable
- **Rate Limiting**: Prevents excessive API calls during monitoring

## Data Flow

### Snippet Workflow
1. User creates snippet via Snippet Editor
2. Form validation using Zod schemas
3. API call to POST /api/snippets
4. Database insertion with unique trigger validation
5. Client state update via React Query
6. UI refresh with new snippet available

### Clipboard Workflow
1. Background monitor detects clipboard changes
2. Content classification and deduplication
3. API call to POST /api/clipboard
4. Database storage with timestamp
5. History management (respects user-defined limits)
6. Real-time UI updates via query invalidation

### Settings Management
1. Settings loaded on application startup
2. Form-based editing with immediate validation
3. API update to PUT /api/settings
4. Global state refresh affecting shortcuts and monitoring
5. Persistent storage ensuring settings survive restarts

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React, React DOM, React Query for state management
- **UI Framework**: Radix UI primitives with Shadcn/ui wrapper components
- **Styling**: Tailwind CSS with PostCSS processing
- **Development**: Vite, TypeScript, ESBuild for optimal build performance

### Database & Validation
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **Neon Database**: Serverless PostgreSQL hosting
- **Zod**: Runtime type validation and schema definition
- **Connect-pg-simple**: Session store for PostgreSQL

### Utility Libraries
- **Date Handling**: date-fns for datetime operations
- **Class Management**: clsx and class-variance-authority for conditional styling
- **Form Management**: React Hook Form with Hookform resolvers
- **Icons**: Lucide React for consistent iconography

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server on port 5000 with Express backend
- **Hot Module Replacement**: Real-time updates for React components
- **Database**: Development PostgreSQL instance via Replit modules
- **Environment Variables**: DATABASE_URL for database connection

### Production Build
- **Client Build**: Vite production build to dist/public directory
- **Server Build**: ESBuild compilation to dist/index.js
- **Static Assets**: Served directly by Express in production
- **Process Management**: PM2 or similar for production process management

### Deployment Configuration
- **Platform**: Replit Autoscale deployment target
- **Port Configuration**: External port 80 mapping to internal port 5000
- **Build Commands**: npm run build for production preparation
- **Start Commands**: npm run start for production server launch

## Changelog

- June 25, 2025. Initial setup - Created full-stack SnipClip application with snippet and clipboard management
- June 25, 2025. Updated design to match Coinbase aesthetic - Applied blue color scheme, rounded corners, modern typography, and full-screen popup overlays
- June 25, 2025. Database migration completed - Moved from memory storage to PostgreSQL for multi-user support
- June 25, 2025. Enhanced keyboard shortcuts - Added customizable keyboard shortcuts with user preference settings
- June 25, 2025. Fixed snippet functionality - Resolved database connection and added default snippets

## User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Clean, modern interface with Coinbase-style blue accents and professional typography.