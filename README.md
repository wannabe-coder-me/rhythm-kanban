# Rhythm Kanban

A modern Kanban board application with spreadsheet view, built with Next.js 14+, Prisma, and PostgreSQL.

## Features

- **Kanban Board View**: Drag & drop columns and tasks with @dnd-kit
- **Spreadsheet View**: Table view with inline editing, sorting, filtering
- **Task Management**: 
  - Title, description, priority (low/medium/high/urgent)
  - Due dates, labels, assignees
  - Comments and activity feed
- **Google OAuth**: NextAuth.js with Google provider
- **Real-time Updates**: Optimistic UI updates

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth
- **Styling**: Tailwind CSS
- **Drag & Drop**: @dnd-kit

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL`: PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL`: Your app URL
   - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Google OAuth credentials

3. Install dependencies:
   ```bash
   npm install
   ```

4. Push database schema:
   ```bash
   npx prisma db push
   ```

5. Run development server:
   ```bash
   npm run dev
   ```

## Deployment

Deployed on Railway with auto-deploy from `main` branch.

## Pages

- `/` - Boards list (home)
- `/boards/[id]` - Kanban board view
- `/boards/[id]/table` - Spreadsheet view
- `/login` - Google OAuth login

## API Routes

- `/api/auth/[...nextauth]` - NextAuth
- `/api/boards` - GET (list), POST (create)
- `/api/boards/[id]` - GET, PATCH, DELETE
- `/api/boards/[id]/columns` - GET, POST
- `/api/columns/[id]` - PATCH, DELETE
- `/api/columns/[id]/tasks` - GET, POST
- `/api/tasks/[id]` - GET, PATCH, DELETE
- `/api/tasks/[id]/comments` - GET, POST
- `/api/users` - GET (for assignment dropdown)
