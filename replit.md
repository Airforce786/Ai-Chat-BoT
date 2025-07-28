# Discord Bot Management Dashboard

## Overview

This project is a full-stack Discord bot management dashboard that provides analytics, memory management, and administrative controls for a Discord bot. The application uses a modern TypeScript stack with React frontend, Express backend, and PostgreSQL database with Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite with custom configuration for client-side builds
- **UI Framework**: Radix UI components with Tailwind CSS and shadcn/ui design system
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with Discord-themed custom CSS variables

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints for CRUD operations
- **Development**: Hot reload with Vite middleware integration
- **Build Process**: esbuild for production bundling

### Database Layer
- **Database**: PostgreSQL (configured for Neon serverless)
- **ORM**: Drizzle ORM with connection pooling
- **Schema**: Comprehensive schema for Discord users, conversations, messages, memory chunks, and analytics
- **Migrations**: Drizzle Kit for schema migrations

## Key Components

### Data Models
The application manages several core entities:
- **Discord Users**: User profiles with memory quotas and usage tracking
- **Conversations**: Chat sessions with metadata and memory usage
- **Messages**: Individual messages with token counting and compression
- **Memory Chunks**: Cached conversation context for AI responses
- **Analytics**: Bot statistics and performance metrics
- **Admin Actions**: Audit log for administrative operations

### Service Layer
- **Memory Manager**: Handles memory optimization, cleanup, and compression
- **Conversation Service**: Manages conversation threads and message processing
- **Analytics Service**: Generates dashboard data and performance reports
- **Admin Commands**: Provides system administration and maintenance tools

### Frontend Components
- **Dashboard**: Main interface with system statistics and navigation
- **System Stats**: Real-time monitoring cards with trend indicators
- **Memory Operations**: Tools for memory management and cleanup
- **User Management**: Discord user administration and search
- **Admin Terminal**: Command-line interface for system operations
- **Conversation List**: Chat history management and export tools

## Data Flow

1. **Client Requests**: Frontend makes API calls using TanStack Query
2. **API Layer**: Express routes handle authentication and validation
3. **Service Layer**: Business logic processes requests and manages data
4. **Database**: Drizzle ORM executes queries against PostgreSQL
5. **Real-time Updates**: Polling-based updates every 10-30 seconds for live data

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL connection
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Headless UI components
- **express**: Web application framework

### Development Tools
- **vite**: Build tool and dev server
- **tsx**: TypeScript execution for development
- **esbuild**: Production bundling
- **tailwindcss**: Utility-first CSS framework

### Discord Integration
The application is designed to work with Discord bots and manages:
- User authentication and profiles
- Message history and context
- Memory optimization for AI responses
- Administrative controls and analytics

## Deployment Strategy

### Development
- Vite dev server with hot module replacement
- Express server with middleware integration
- Environment-based configuration
- TypeScript compilation and type checking

### Production
- Static asset build with Vite
- Express server bundling with esbuild
- PostgreSQL database deployment
- Environment variable configuration for DATABASE_URL

### Build Process
1. Frontend: `vite build` creates optimized static assets
2. Backend: `esbuild` bundles server code for Node.js
3. Database: `drizzle-kit push` applies schema changes
4. Deployment: Single Node.js process serves both API and static files

The application follows a monorepo structure with shared TypeScript definitions and maintains type safety across the full stack.