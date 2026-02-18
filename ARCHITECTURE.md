# Rhythm Kanban - Architecture

## Overview

A modern Kanban board application with real-time collaboration, RBAC permissions, Google Calendar integration, and team features. Built for Rhythm's internal project management.

**URL**: https://kanban.rhythm.engineering

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (Google OAuth) |
| Styling | Tailwind CSS |
| Drag & Drop | @dnd-kit |
| Real-time | Server-Sent Events (SSE) |
| Calendar | Google Calendar API |
| Deployment | Railway (auto-deploy from `main`) |

## Project Structure

```
rhythm-kanban/
├── prisma/
│   └── schema.prisma       # Database schema
├── public/
│   └── uploads/            # File attachments storage
├── src/
│   ├── app/
│   │   ├── admin/          # Admin panel
│   │   ├── boards/[id]/    # Board views (kanban + table)
│   │   │   └── table/      # Table view
│   │   ├── invite/[token]/ # Invite acceptance
│   │   ├── my-tasks/       # Cross-board task list
│   │   ├── notifications/  # Notification center
│   │   ├── api/
│   │   │   ├── admin/      # Admin API routes
│   │   │   ├── auth/       # NextAuth endpoints
│   │   │   ├── boards/     # Board CRUD + labels + members + invites
│   │   │   ├── calendar/   # Google Calendar integration
│   │   │   │   ├── connect/    # OAuth connection
│   │   │   │   ├── events/     # CRUD calendar events
│   │   │   │   └── events/[id] # Single event operations
│   │   │   ├── columns/    # Column CRUD
│   │   │   ├── tasks/      # Task CRUD + comments + attachments
│   │   │   └── users/      # User endpoints
│   │   ├── login/          # Login page
│   │   └── page.tsx        # Home (board list)
│   ├── components/
│   │   ├── calendar/
│   │   │   ├── CalendarPanel.tsx   # Calendar sidebar panel
│   │   │   └── useCalendar.ts      # Calendar hook (state + API)
│   │   ├── BoardSettings.tsx    # Board settings modal
│   │   ├── Column.tsx           # Kanban column (responsive width)
│   │   ├── FilterBar.tsx        # Filters & search
│   │   ├── InviteModal.tsx      # Invite members
│   │   ├── LabelManager.tsx     # Manage board labels
│   │   ├── TaskCard.tsx         # Task card
│   │   ├── TaskDetailPanel.tsx  # Task detail sidebar
│   │   └── Toast.tsx            # Toast notifications
│   ├── hooks/
│   │   ├── useBoardEvents.ts    # SSE subscription
│   │   └── useFilters.ts        # Filter state management
│   ├── lib/
│   │   ├── auth.ts              # NextAuth config
│   │   ├── google-calendar.ts   # Google Calendar API wrapper
│   │   ├── prisma.ts            # Prisma client
│   │   └── permissions.ts       # RBAC helpers
│   └── types/
│       └── index.ts             # App types
```

## Calendar Integration

### Features
- **Drag tasks to calendar**: Drag a task from kanban to a calendar time slot to schedule it
- **Priority colors sync**: Task priority maps to Google Calendar colors
  - Urgent → Red (colorId: 11)
  - High → Orange (colorId: 6)
  - Medium → Yellow (colorId: 5)
  - Low → Green (colorId: 2)
- **Resize events**: Drag top/bottom handles to change duration
- **Delete events**: Hover to reveal delete button
- **Week starts Monday**: Business-friendly week layout
- **Variable row heights**: Business hours (6am-6pm) = 48px, off-hours = 20px

### Architecture
```
CalendarPanel (UI)
    ↓
useCalendar hook (state management)
    ↓
/api/calendar/events (API routes)
    ↓
google-calendar.ts (Google API wrapper)
    ↓
Google Calendar API
```

### Proposed Color Palette (Softer)

Current Google Calendar colors are harsh and clash. Planned redesign:

**Calendar Event Colors:**
| Purpose        | Hex       | Name            |
|----------------|-----------|-----------------|
| Default        | #64748b   | Soft slate blue |
| Alternative 1  | #be6b7a   | Muted rose      |
| Alternative 2  | #d4a574   | Soft amber      |
| Alternative 3  | #6b9080   | Sage            |
| Alternative 4  | #7cb4c4   | Soft sky        |

**Priority Colors:**
| Priority | Hex       | Name        |
|----------|-----------|-------------|
| Urgent   | #e87777   | Soft coral  |
| High     | #e6a855   | Warm amber  |
| Medium   | #6b9cd4   | Calm blue   |
| Low      | #6b9c7a   | Sage green  |

**Design principles:**
- Keep dark slate base
- Use opacity variations instead of many hues
- Calendar events: ~40-50% saturation

### Data Model
```
CalendarConnection
├── userId → User
├── provider: 'google'
├── accessToken, refreshToken
├── tokenExpiry, lastSyncAt

CalendarEvent
├── calendarConnectionId
├── externalEventId (Google event ID)
├── taskId → Task (optional link)
├── title, description
├── startTime, endTime
├── recurrence, color
├── syncStatus
```

### DnD Integration
- CalendarPanel must be inside DndContext for drag-drop to work
- TimeSlot components use `useDroppable` from @dnd-kit
- Tasks use `useDraggable` - can drop on calendar slots
- On drop: creates Google Calendar event linked to task

## Data Model (Core)

```
User
├── id, email, name, image
├── role: 'admin' | 'manager' | 'user'
├── ownedBoards, boardMembers
├── calendarConnections

Board
├── id, name, description
├── visibility: 'private' | 'team' | 'public'
├── ownerId → User
├── columns, members, labels

Column
├── id, boardId, name, position, color
├── tasks

Task
├── id, columnId, title, description
├── position, priority, dueDate, completed
├── assigneeId, createdById
├── labels, subtasks, comments, attachments
├── calendarEvents (linked calendar entries)

Label
├── id, boardId, name, color
├── tasks (many-to-many)
```

## Views

### Kanban Board (`/boards/[id]`)
- Drag-and-drop columns and tasks
- Columns shrink (min 200px) when calendar expands
- Filter bar with search, assignee, priority, labels
- Calendar panel slides in from right

### Table View (`/boards/[id]/table`)
- Compact rows (py-1 padding)
- Small checkboxes (14px)
- Inline editing
- Same filters as kanban

### Calendar Panel (sidebar)
- Week view with Monday start
- Day view option
- All-day events section
- Timed events with priority colors
- Resize handles (12px, visible on hover)
- Delete button (red X, hover)

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/calendar/events` | List/create events |
| GET/PATCH/DELETE | `/api/calendar/events/[id]` | Event CRUD |
| POST | `/api/calendar/connect` | Start OAuth flow |
| GET | `/api/calendar/callback` | OAuth callback |
| GET/POST | `/api/boards` | List/create boards |
| GET/PATCH/DELETE | `/api/boards/[id]` | Board CRUD |
| GET/POST | `/api/tasks` | List/create tasks |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Task CRUD |

## Environment Variables

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://kanban.rhythm.engineering
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Deployment

- **Platform**: Railway
- **URL**: https://kanban.rhythm.engineering
- **Trigger**: Auto-deploy on push to `main`
- **Database**: Railway PostgreSQL

```bash
# Deploy
cd ~/clawd/rhythm-kanban
git add -A && git commit -m "message" && git push origin main
```

## Local Development

```bash
npm install
npm run dev  # http://localhost:3000
```

## Known Issues & Fixes (Feb 2026)

### PWA Touch Target Override
The PWA CSS sets `min-height: 44px` on form controls for touch accessibility. In table view, this makes checkboxes huge. Override with:
```css
.table-checkbox {
  min-height: 12px !important;
  min-width: 12px !important;
  width: 12px !important;
  height: 12px !important;
}
```

### Date Picker Icon Styling
Native browser date picker icons can't be reliably styled across browsers. Solution: hide the native picker icon with CSS and add a manual SVG icon:
```css
.table-date-input::-webkit-calendar-picker-indicator {
  display: none !important;
}
```

### SSE Connection Stability
The `useBoardEvents` hook must use a **ref** for the `onEvent` callback, not a dependency. Otherwise, every parent re-render causes SSE reconnection loops and UI flicker:
```typescript
const onEventRef = useRef(onEvent);
useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
// In connect(): onEventRef.current(event) instead of onEvent(event)
```

### Presence Indicator Performance
- Removed `animate-ping` from green "online" dot (caused visual flicker)
- Wrapped component in `React.memo` with custom comparison to prevent re-renders when user array reference changes but content is the same

### Suppressed "Joined Board" Toasts
The `user:joined` event fires on every page load/reconnect, not just first join. Toast notification removed - connected users shown in header instead.
