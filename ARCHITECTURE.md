# Rhythm Kanban - Architecture

## Overview

A modern Kanban board application with spreadsheet view, drag-and-drop columns/tasks, and team collaboration features.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (Google OAuth) |
| Styling | Tailwind CSS |
| Drag & Drop | @dnd-kit |
| Deployment | Railway (auto-deploy from `main`) |

## Project Structure

```
rhythm-kanban/
├── prisma/
│   └── schema.prisma       # Database schema
├── src/
│   ├── app/
│   │   ├── admin/          # Admin panel (user management)
│   │   ├── boards/[id]/    # Board views (kanban + table)
│   │   ├── api/
│   │   │   ├── admin/      # Admin API routes
│   │   │   ├── auth/       # NextAuth endpoints
│   │   │   ├── boards/     # Board CRUD
│   │   │   ├── columns/    # Column CRUD
│   │   │   ├── tasks/      # Task CRUD + comments
│   │   │   └── users/      # User endpoints
│   │   ├── login/          # Login page
│   │   └── page.tsx        # Home (board list)
│   ├── components/
│   │   ├── Column.tsx      # Kanban column
│   │   ├── TaskCard.tsx    # Task card component
│   │   └── TaskDetailPanel.tsx  # Task detail sidebar
│   ├── lib/
│   │   ├── auth.ts         # NextAuth config
│   │   └── prisma.ts       # Prisma client
│   └── types/
│       ├── index.ts        # App types
│       └── next-auth.d.ts  # Session type extensions
├── .env.example            # Environment template
├── railway.toml            # Railway config
└── tailwind.config.ts
```

## Data Model

```
User
├── id, email, name, image, role (admin/member)
├── accounts (OAuth)
├── sessions
├── boardMembers → Board membership
├── tasksAssigned / tasksCreated
├── comments, activities

Board
├── id, name, description
├── columns → Column[]
├── members → BoardMember[]

Column
├── id, boardId, name, position, color
├── tasks → Task[]

Task
├── id, columnId, title, description
├── position, priority, dueDate, labels[]
├── completed, assigneeId, createdById
├── parentId (subtasks)
├── comments, activities

Comment / Activity
├── Linked to Task + User
```

## Authentication

- **Provider**: Google OAuth via NextAuth.js
- **Adapter**: Prisma (stores sessions in DB)
- **Session**: Contains `id`, `role`, `name`, `email`, `image`
- **Roles**: `admin` (full access), `member` (standard)

## Key Features

### Kanban Board (`/boards/[id]`)
- Drag-and-drop columns and tasks (@dnd-kit)
- Add/edit/delete columns
- Task cards with priority badges, due dates, assignees

### Spreadsheet View (`/boards/[id]/table`)
- Table view of all tasks
- Inline editing
- Sorting and filtering

### Task Details
- Slide-out panel for task editing
- Comments and activity feed
- Subtask support

### Admin Panel (`/admin`)
- View all users
- Add users by email (pre-provision before OAuth)
- Change user roles
- Delete users

### Subtasks (Asana-style)
- Expand/collapse chevron on parent tasks
- Nested subtasks with progress bar (X/Y completed)
- Checkable directly from board view
- Subtasks follow parent (not separately draggable)

### Column Reordering
- Drag column headers to rearrange
- Position persists via API

## Environment Variables

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Deployment

- **Platform**: Railway
- **Trigger**: Auto-deploy on push to `main`
- **Build**: `prisma generate && prisma db push && next build`
- **Start**: `next start`

## Local Development

```bash
# Install deps
npm install

# Set up .env from .env.example

# Push schema to DB
npx prisma db push

# Run dev server
npm run dev
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/boards` | List/create boards |
| GET/PATCH/DELETE | `/api/boards/[id]` | Board CRUD |
| GET/POST | `/api/boards/[id]/columns` | List/create columns |
| PATCH/DELETE | `/api/columns/[id]` | Column update/delete |
| POST | `/api/columns/[id]/tasks` | Create task |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Task CRUD |
| GET/POST | `/api/tasks/[id]/comments` | Task comments |
| GET/POST | `/api/admin/users` | Admin: list/add users |
| PATCH/DELETE | `/api/admin/users/[id]` | Admin: update/delete user |
| PATCH | `/api/boards/[id]/columns/reorder` | Reorder columns |
