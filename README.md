# SnipClip

A powerful clipboard and snippet management application that helps you organize, search, and access your frequently used text snippets and clipboard history with lightning-fast keyboard shortcuts.

## ✨ Features

### 🔄 Smart Clipboard Management
- **Automatic Monitoring**: Automatically captures and saves clipboard content
- **Content Type Detection**: Intelligently categorizes content as text, URL, or code
- **History Limit**: Configurable history limit to manage storage
- **Quick Access**: Global keyboard shortcut (`Ctrl+Alt+Enter`) for instant clipboard history access

### 📝 Snippet Management
- **Create & Edit**: Easy snippet creation with title, content, and trigger shortcuts
- **Folder Organization**: Organize snippets into custom folders
- **Search & Filter**: Powerful search across snippet titles, content, and triggers
- **Quick Insert**: Global keyboard shortcut (`Alt+Enter`) for instant snippet access
- **Copy to Clipboard**: One-click copying of snippet content

### ⌨️ Keyboard Shortcuts
- `Ctrl+Alt+Enter`: Open clipboard history overlay
- `Alt+Enter`: Open snippet manager overlay
- `Arrow Keys`: Navigate through items in overlays
- `Enter`: Select and copy item to clipboard
- `Escape`: Close overlays

### 🎨 Modern UI/UX
- Clean, intuitive interface built with React and Tailwind CSS
- Responsive design that works on all screen sizes
- Dark/light theme support
- Toast notifications for user feedback
- Overlay-based quick access system

### 🔐 User Authentication
- Secure session-based authentication
- User-specific data isolation
- Persistent login sessions

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** components for accessibility
- **Framer Motion** for animations
- **TanStack Query** for state management
- **Wouter** for routing

### Backend
- **Node.js** with Express.js
- **TypeScript** throughout
- **Drizzle ORM** for database operations
- **Session-based authentication**
- **WebSocket support** for real-time features

### Database
- **PostgreSQL** (production)
- **SQLite** (development)
- **Automatic migrations** with Drizzle Kit

### Development Tools
- **Vite** for fast development and building
- **ESBuild** for production bundling
- **TypeScript** for type safety
- **Cross-platform** support (Windows, macOS, Linux)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL (for production) or SQLite (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SnipClip
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   NODE_ENV=development
   DATABASE_URL=your_database_connection_string
   SESSION_SECRET=your_session_secret
   ```

4. **Initialize the database**
   ```bash
   npm run db:init
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5002` in development mode.

## 📋 Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run check` - Run TypeScript type checking

### Database Management
- `npm run db:push` - Push schema changes to database
- `npm run db:status` - Check database connection and status
- `npm run db:init` - Initialize database with tables
- `npm run db:test` - Test database connection
- `npm run db:reset` - Reset database (⚠️ destructive)

### Production
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run deploy` - Deploy to production

### Maintenance
- `npm run fix:folders` - Fix snippet folder relationships
- `npm run remove:subfolders` - Clean up subfolder structure

## 🗄️ Database Schema

### Core Tables
- **snippets**: User-created text snippets with triggers and metadata
- **folders**: Organization system for grouping snippets
- **clipboard_items**: Automatically captured clipboard history
- **settings**: User preferences and configuration

### Key Features
- User isolation (all data tied to `userId`)
- Automatic timestamps for created/updated records
- Unique constraints to prevent duplicates
- Foreign key relationships for data integrity

## 🔧 Configuration

### Settings
Users can configure:
- **Keyboard Shortcuts**: Customize global hotkeys
- **Clipboard Monitoring**: Enable/disable automatic capture
- **History Limit**: Maximum number of clipboard items to store
- **Launch on Startup**: Auto-start with system (planned feature)
- **Theme**: Light/dark mode preference

### Environment Variables
- `NODE_ENV`: Environment mode (development/production)
- `DATABASE_URL`: Database connection string
- `SESSION_SECRET`: Secret key for session encryption

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure session secret
4. Build and start the application

### Render.com Deployment
The project includes a `render.yaml` configuration for easy deployment to Render.com:

```bash
npm run deploy
```

## 🏗️ Project Structure

```
SnipClip/
├── client/               # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility libraries
│   │   └── pages/        # Application pages
├── server/               # Express.js backend
│   ├── auth.ts          # Authentication logic
│   ├── db.ts            # Database configuration
│   ├── routes.ts        # API endpoints
│   └── index.ts         # Server entry point
├── shared/               # Shared TypeScript types
│   └── schema.ts        # Database schema and types
├── scripts/              # Database and maintenance scripts
└── data/                 # Development data storage
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use the existing component patterns
- Ensure accessibility with Radix UI components
- Test database changes with both SQLite and PostgreSQL
- Update documentation for new features

## 📝 API Endpoints

### Snippets
- `GET /api/snippets` - List all user snippets
- `POST /api/snippets` - Create new snippet
- `PUT /api/snippets/:id` - Update snippet
- `DELETE /api/snippets/:id` - Delete snippet

### Folders
- `GET /api/folders` - List all user folders
- `POST /api/folders` - Create new folder
- `PUT /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder

### Clipboard
- `GET /api/clipboard` - Get clipboard history
- `POST /api/clipboard` - Add clipboard item
- `DELETE /api/clipboard/:id` - Delete clipboard item

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

## 🐛 Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
npm run db:status
```

**Build Failures**
```bash
npm run check  # Check TypeScript errors
npm install    # Reinstall dependencies
```

**Clipboard Access Issues**
- Ensure the application has clipboard permissions
- Check browser security settings for localhost
- Try running with HTTPS in production

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with modern web technologies
- UI components by Radix UI
- Icons by Lucide React
- Database ORM by Drizzle
