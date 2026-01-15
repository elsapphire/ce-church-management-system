# CE Attendance System

## Overview

A web-based church attendance monitoring platform for Christ Embassy Abuja Zone 1. The system manages church member registration, organizes members by hierarchical structure (Church → Group → PCF → Cell), tracks attendance per service, and produces leadership-ready reports. Built with a modern React frontend and Express backend using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing with protected route patterns
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens defined in CSS variables
- **Charts**: Recharts for attendance analytics and dashboard visualizations
- **Forms**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **API Pattern**: RESTful API with shared route contracts between frontend and backend
- **Authentication**: Session-based authentication with Passport.js, supporting both local auth (username/password with bcrypt) and Replit Auth integration
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: Shared schema in `shared/schema.ts` for type safety across frontend and backend
- **Migrations**: Drizzle Kit for database migrations stored in `./migrations`

### Project Structure
- `client/` - React frontend application
- `server/` - Express backend with API routes and authentication
- `shared/` - Shared TypeScript types, schemas, and route contracts
- `attached_assets/` - Static assets like logos

### Key Design Decisions
1. **Shared Route Contracts**: API routes defined in `shared/routes.ts` with Zod schemas for request/response validation, ensuring type safety between frontend and backend
2. **Hierarchical Data Model**: Church → Group → PCF → Cell structure reflects the organization's actual hierarchy
3. **Dual Authentication**: Supports both traditional username/password login and Replit Auth for seamless development experience
4. **Component-Based UI**: Leverages shadcn/ui for consistent, accessible UI components following the design guidelines in `design_guidelines.md`

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries with automatic schema inference

### Authentication Services
- **Replit Auth (Optional)**: OpenID Connect integration for Replit-hosted deployments
- **express-session**: Server-side session management
- **bcrypt**: Password hashing for local authentication

### Frontend Libraries
- **@tanstack/react-query**: Server state management and API caching
- **Radix UI**: Accessible UI primitives (dialog, dropdown, tabs, etc.)
- **Recharts**: Data visualization for attendance reports
- **date-fns**: Date formatting and manipulation
- **Zod**: Schema validation for forms and API contracts

### Build Tools
- **Vite**: Frontend development server and bundler
- **esbuild**: Server-side bundling for production
- **TypeScript**: Type checking across the entire codebase