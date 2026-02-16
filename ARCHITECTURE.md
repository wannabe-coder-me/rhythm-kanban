# Rhythm Kanban - Architecture

## Overview

A modern Kanban board application with real-time collaboration, RBAC permissions, and team features. Built for Rhythm's internal project management.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (Google OAuth) |
| Styling | Tailwind CSS |
| Drag & Drop | @dnd-kit |
| Real-time | Server-Sent Events (SSE) |
| Deployment | Railway (auto-deploy from `main`) |

## Project Structure

```
rhythm-kanban/
├── prisma/
│   └── schema.prisma       # Database schema
├── public/
│   └── uploads/            # File attachments storage
├── scripts/
│   └── fix-board-membership.ts  # Migration helper
├── src/
│   ├── app/
│   │   ├── admin/          # Admin panel
│   │   ├── boards/[id]/    # Board views (kanban + table)
│   │   ├── invite/[token]/ # Invite acceptance
│   │   ├── my-tasks/       # Cross-board task list
│   │   ├── notifications/  # Notification center
│   │   ├── api/
│   │   │   ├── admin/      # Admin API routes
│   │   │   ├── auth/       # NextAuth endpoints
│   │   │   ├── boards/     # Board CRUD + labels + members + invites + events
│   │   │   ├── columns/    # Column CRUD
│   │   │   ├── invites/    # Invite acceptance
│   │   │   ├── my-tasks/   # User's tasks
│   │   │   ├── notifications/ # Notifications
│   │   │   ├── tasks/      # Task CRUD + comments + attachments
│   │   │   └── users/      # User endpoints
│   │   ├── login/          # Login page
│   │   └── page.tsx        # Home (board list)
│   ├── components/
│   │   ├── BoardSettings.tsx    # Board settings modal
│   │   ├── Column.tsx           # Kanban column
│   │   ├── FilterBar.tsx        # Filters & search
│   │   ├── InviteModal.tsx      # Invite members
│   │   ├── LabelManager.tsx     # Manage board labels
│   │   ├── LabelSelector.tsx    # Select labels for task
│   │   ├── PresenceIndicator.tsx # Who's viewing
│   │   ├── TaskCard.tsx         # Task card
│   │   ├── TaskDetailPanel.tsx  # Task detail sidebar
│   │   └── Toast.tsx            # Toast notifications
│   ├── hooks/
│   │   ├── useBoardEvents.ts    # SSE subscription
│   │   └── useFilters.ts        # Filter state management
│   ├── lib/
│   │   ├── auth.ts              # NextAuth config
│   │   ├── events.ts            # SSE pub/sub
│   │   ├── label-colors.ts      # Preset label colors
│   │   ├── notifications.ts     # Notification helpers
│   │   ├── permissions.ts       # RBAC helpers
│   │   └── prisma.ts            # Prisma client
│   └── types/
│       ├── index.ts             # App types
│       └── next-auth.d.ts       # Session type extensions
├── .env.example
├── railway.toml
└── tailwind.config.ts
```

## Data Model

```
User
├── id, email, name, image
├── role: 'admin' | 'manager' | 'user' (system role)
├── ownedBoards, boardMembers
├── tasksAssigned, tasksCreated
├── comments, activities, attachments
├── notifications

Board
├── id, name, description
├── visibility: 'private' | 'team' | 'public'
├── ownerId → User (owner)
├── columns, members, labels, invites

BoardMember
├── boardId, userId
├── role: 'admin' | 'member' | 'viewer'
├── invitedById, invitedAt, joinedAt

BoardInvite
├── boardId, email, role, token
├── status: 'pending' | 'accepted' | 'revoked' | 'expired'
├── invitedById, expiresAt

Column
├── id, boardId, name, position, color
├── tasks

Task
├── id, columnId, title, description
├── position, priority, dueDate, completed
├── assigneeId, createdById, parentId (subtasks)
├── labels (many-to-many)
├── comments, activities, attachments, subtasks

Label
├── id, boardId, name, color
├── tasks (many-to-many)

Attachment
├── id, taskId, filename, url, mimeType, size
├── uploadedById

Comment / Activity
├── Linked to Task + User

Notification
├── id, userId, type, title, message, link
├── read, createdAt
```

## Authentication & Authorization

### System Roles
| Role | Permissions |
|------|-------------|
| Admin | Full access, manage all users/boards, system settings |
| Manager | Create boards, manage team members, view team boards |
| User | Create personal boards, join boards when invited |

### Board Roles
| Role | Permissions |
|------|-------------|
| Owner | Full control, delete board, transfer ownership |
| Admin | Edit settings, manage members, all task actions |
| Member | Create/edit/move tasks, comment |
| Viewer | View only, can comment |

### Board Visibility
| Type | Access |
|------|--------|
| Private | Invited members only |
| Team | All authenticated users can view |
| Public | Anyone with link (logged in) |

## Key Features

### Kanban Board (`/boards/[id]`)
- Drag-and-drop columns and tasks (@dnd-kit)
- Column reordering
- Filter bar (assignee, priority, due date, labels, search)
- Real-time updates with SSE
- Presence indicators (who's viewing)

### Subtasks (Asana-style)
- Nested under parent tasks
- Expand/collapse chevron
- Progress bar (X/Y completed)
- Checkable from board view

### Table View (`/boards/[id]/table`)
- Spreadsheet view of all tasks
- Same filters as kanban
- Labels column

### Task Details (slide-out panel)
- Title, description, priority, due date
- Assignee, status (column)
- Labels (multi-select)
- File attachments (drag-drop upload)
- Subtasks
- Comments & activity feed

### Labels/Tags
- Per-board labels with colors
- 8 preset colors
- Label manager modal
- Filter by label

### Real-time Updates
- SSE endpoint: `/api/boards/[id]/events`
- Events: task/column CRUD, moves, reorders
- Presence: see who's viewing
- Toast notifications for remote changes

### Notifications
- Bell icon with unread count
- Triggers: assigned, mentioned, comments
- `/notifications` page

### My Tasks (`/my-tasks`)
- All tasks assigned to user across boards
- Grouped by due date (overdue, today, this week)
- Quick complete/priority actions

### Admin Panel (`/admin`)
- Users tab: manage system roles, delete users
- Boards tab: view all, transfer ownership, delete
- System admins only

### Board Settings
- General: name, description, visibility
- Members: list, change roles, remove
- Invites: email or link, pending invites
- Danger: transfer ownership, delete board

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/boards` | List/create boards |
| GET/PATCH/DELETE | `/api/boards/[id]` | Board CRUD |
| GET/POST | `/api/boards/[id]/columns` | List/create columns |
| PATCH | `/api/boards/[id]/columns/reorder` | Reorder columns |
| GET/POST/PATCH/DELETE | `/api/boards/[id]/labels` | Board labels |
| GET | `/api/boards/[id]/events` | SSE real-time stream |
| GET/POST | `/api/boards/[id]/members` | Board members |
| PATCH/DELETE | `/api/boards/[id]/members/[userId]` | Update/remove member |
| GET/POST | `/api/boards/[id]/invites` | Board invites |
| PATCH/DELETE | `/api/columns/[id]` | Column update/delete |
| POST | `/api/columns/[id]/tasks` | Create task |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Task CRUD |
| POST | `/api/tasks/[id]` | Create subtask |
| GET/POST | `/api/tasks/[id]/comments` | Task comments |
| GET/POST/DELETE | `/api/tasks/[id]/attachments` | File attachments |
| GET/POST | `/api/invites/[token]` | Get/accept invite |
| GET | `/api/my-tasks` | User's tasks across boards |
| GET/PATCH/DELETE | `/api/notifications` | User notifications |
| GET/POST | `/api/admin/users` | Admin: list/add users |
| PATCH/DELETE | `/api/admin/users/[id]` | Admin: update/delete user |
| GET | `/api/admin/boards` | Admin: list all boards |
| PATCH/DELETE | `/api/admin/boards/[id]` | Admin: update/delete board |

## Environment Variables

```bash
DATABASE_URL=postgresql://...  # Railway PostgreSQL
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://your-railway-url.up.railway.app
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
# Get DATABASE_URL from Railway

# Push schema
npx prisma db push

# Run dev server
npm run dev
```
