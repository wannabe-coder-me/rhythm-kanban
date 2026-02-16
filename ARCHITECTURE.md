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

Attachment
├── id, taskId, filename, url
├── mimeType, size, uploadedById
├── createdAt
├── Linked to Task + User (uploader)

Label (planned)
├── id, boardId, name, color
├── tasks (many-to-many)

Notification (planned)
├── id, userId, type, title, message
├── link, read, createdAt
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

### File Attachments
- Drag-and-drop upload zone in task detail panel
- Supports images, PDFs, docs, spreadsheets (max 10MB)
- Files stored in `/public/uploads/{taskId}/`
- Attachment count shown on task cards (📎 3)
- Image previews, file type icons
- Activity log for attachments

### Column Reordering
- Drag column headers to rearrange
- Position persists via API

## Planned Features (In Progress)

### Labels/Tags
- Colored labels per board (red, blue, green, etc.)
- Assign multiple labels to tasks
- Label management in board settings
- API: `/api/boards/[id]/labels`

### Filters & Search
- Filter bar above kanban columns
- Filter by: assignee, priority, due date, labels
- Search task title/description
- Filters persist in URL params

### Real-time Updates
- Server-Sent Events (SSE) for live board updates
- See changes when teammates move/edit tasks
- Endpoint: `/api/boards/[id]/events`
- Hook: `useBoardEvents(boardId, onEvent)`

### Notifications
- In-app notifications (assigned, mentioned, comments, due soon)
- Bell icon with unread count in header
- Notifications page at `/notifications`
- API: `/api/notifications`

### My Tasks View
- `/my-tasks` - All tasks assigned to current user
- Grouped by due date (Overdue, Today, This Week, etc.)
- Quick actions: mark complete, change priority

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
| GET/POST/DELETE | `/api/tasks/[id]/attachments` | Task file attachments |
| GET/POST | `/api/admin/users` | Admin: list/add users |
| PATCH/DELETE | `/api/admin/users/[id]` | Admin: update/delete user |
| PATCH | `/api/boards/[id]/columns/reorder` | Reorder columns |
| GET/POST/PATCH/DELETE | `/api/boards/[id]/labels` | Board labels (planned) |
| GET | `/api/boards/[id]/events` | SSE real-time stream (planned) |
| GET/PATCH/DELETE | `/api/notifications` | User notifications (planned) |
| GET | `/api/my-tasks` | Tasks assigned to user (planned) |
