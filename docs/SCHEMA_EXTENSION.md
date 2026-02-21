# Life System - Schema Extension

## New Models

Add these to `prisma/schema.prisma`:

```prisma
// ============================================
// LIFE SYSTEM MODELS
// ============================================

enum Pillar {
  HEALTH
  WEALTH
  RELATIONSHIPS
  CAREER
  SPIRITUAL
  CONTRIBUTION
}

enum TimeHorizon {
  ONE_YEAR
  THREE_YEAR
  FIVE_YEAR
  SOMEDAY
}

// Vision - Dreams without limits
model Vision {
  id          String      @id @default(cuid())
  userId      String
  pillar      Pillar
  title       String
  description String?     @db.Text
  imageUrl    String?     // Vision board image
  horizon     TimeHorizon @default(SOMEDAY)
  order       Int         @default(0)
  archived    Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, pillar])
}

// North Star - 12-month focus goals
model NorthStar {
  id          String    @id @default(cuid())
  userId      String
  pillar      Pillar
  title       String
  description String?   @db.Text
  targetDate  DateTime? // Target completion date
  progress    Int       @default(0) // 0-100
  active      Boolean   @default(true) // Current year's goal
  achieved    Boolean   @default(false)
  achievedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  actions     Task[]    // Tasks linked to this north star
  milestones  Milestone[]

  @@unique([userId, pillar, active]) // One active north star per pillar
  @@index([userId])
}

// Milestone - Checkpoints toward North Star
model Milestone {
  id          String    @id @default(cuid())
  northStarId String
  title       String
  targetDate  DateTime?
  completed   Boolean   @default(false)
  completedAt DateTime?
  order       Int       @default(0)
  createdAt   DateTime  @default(now())

  northStar   NorthStar @relation(fields: [northStarId], references: [id], onDelete: Cascade)

  @@index([northStarId])
}

// Daily Ritual Entry
model RitualEntry {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime @db.Date // The day this ritual is for
  type        String   // 'morning' or 'evening'
  
  // Morning ritual fields
  gratitude1  String?
  gratitude2  String?
  gratitude3  String?
  gratitude4  String?
  gratitude5  String?
  
  proud1      String?
  proud2      String?
  proud3      String?
  proud4      String?
  proud5      String?
  
  identity    String?  // "Who must I become today?"
  
  // Evening ritual fields
  wins        String?  @db.Text // What went well
  reflection  String?  @db.Text // Any insights
  
  northStarReviewed Boolean @default(false)
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date, type])
  @@index([userId, date])
}

// Identity Statement
model Identity {
  id          String   @id @default(cuid())
  userId      String
  pillar      Pillar
  statement   String   // "I am a person who..."
  active      Boolean  @default(true)
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  habits      Habit[]
  proofs      IdentityProof[]

  @@index([userId, pillar])
}

// Habit linked to Identity
model Habit {
  id          String   @id @default(cuid())
  identityId  String
  title       String   // "Exercise daily"
  frequency   String   @default("daily") // daily, weekly, etc.
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  identity    Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  completions HabitCompletion[]

  @@index([identityId])
}

// Habit Completion Log
model HabitCompletion {
  id          String   @id @default(cuid())
  habitId     String
  date        DateTime @db.Date
  completed   Boolean  @default(true)
  note        String?
  createdAt   DateTime @default(now())

  habit       Habit    @relation(fields: [habitId], references: [id], onDelete: Cascade)

  @@unique([habitId, date])
  @@index([habitId, date])
}

// Identity Proof - Evidence supporting identity
model IdentityProof {
  id          String   @id @default(cuid())
  identityId  String
  content     String   // "Ran my first 5K"
  date        DateTime @default(now())
  createdAt   DateTime @default(now())

  identity    Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@index([identityId])
}

// Life Score - Weekly assessment
model LifeScore {
  id          String   @id @default(cuid())
  userId      String
  weekStart   DateTime @db.Date // Monday of the week
  
  healthScore      Int? // 1-10
  wealthScore      Int?
  relationScore    Int?
  careerScore      Int?
  spiritualScore   Int?
  contributionScore Int?
  
  overallScore     Int? // Calculated average
  notes            String? @db.Text
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([userId])
}

// Weekly Review Entry
model WeeklyReview {
  id          String   @id @default(cuid())
  userId      String
  weekStart   DateTime @db.Date
  
  wins        String?  @db.Text // Celebrations
  insights    String?  @db.Text // What I learned
  adjustments String?  @db.Text // Course corrections
  nextFocus   String?  @db.Text // Next week priorities
  
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([userId])
}

// User Settings for Life System
model LifeSettings {
  id                  String   @id @default(cuid())
  userId              String   @unique
  
  morningRitualTime   String?  // "07:00"
  eveningRitualTime   String?  // "21:00"
  weeklyReviewDay     Int      @default(0) // 0=Sunday
  timezone            String   @default("America/Chicago")
  
  onboardingCompleted Boolean  @default(false)
  onboardingStep      Int      @default(0)
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Extend Existing Task Model

```prisma
model Task {
  // ... existing fields ...
  
  // NEW: Link to North Star
  northStarId String?
  northStar   NorthStar? @relation(fields: [northStarId], references: [id], onDelete: SetNull)
  
  // NEW: Energy level for task
  energyLevel String?    // 'high', 'medium', 'low'
  
  // NEW: Time estimate in minutes
  timeEstimate Int?
}
```

## Extend User Model

```prisma
model User {
  // ... existing fields ...
  
  // NEW: Life System relations
  visions       Vision[]
  northStars    NorthStar[]
  ritualEntries RitualEntry[]
  identities    Identity[]
  lifeScores    LifeScore[]
  weeklyReviews WeeklyReview[]
  lifeSettings  LifeSettings?
}
```

---

## Migration Steps

1. Add new models to schema
2. Run `npx prisma migrate dev --name life_system_models`
3. Seed default data (see below)

## Seed Data

```typescript
// prisma/seed-life.ts

const PILLAR_DESCRIPTIONS = {
  HEALTH: "Physical & mental wellness",
  WEALTH: "Financial abundance & assets", 
  RELATIONSHIPS: "Family, friends, connections",
  CAREER: "Business, work, professional impact",
  SPIRITUAL: "Inner growth, purpose, meaning",
  CONTRIBUTION: "Giving back, charity, legacy"
};

// Create default life settings for new users
async function createLifeSettings(userId: string) {
  await prisma.lifeSettings.create({
    data: {
      userId,
      morningRitualTime: "07:00",
      eveningRitualTime: "21:00",
      weeklyReviewDay: 0, // Sunday
    }
  });
}
```

---

## API Routes Needed

```
/api/life/visions
  GET    - List visions by pillar
  POST   - Create vision

/api/life/visions/[id]
  PATCH  - Update vision
  DELETE - Delete vision

/api/life/north-stars
  GET    - Get active north stars
  POST   - Create/update north star

/api/life/north-stars/[id]
  PATCH  - Update progress
  DELETE - Archive

/api/life/rituals
  GET    - Get ritual for date
  POST   - Save ritual entry

/api/life/identities
  GET    - List identities
  POST   - Create identity
  
/api/life/habits
  GET    - List habits with streaks
  POST   - Create habit
  
/api/life/habits/[id]/complete
  POST   - Mark habit complete for date

/api/life/scores
  GET    - Get life scores (weekly)
  POST   - Submit weekly score

/api/life/reviews
  GET    - Get weekly reviews
  POST   - Submit weekly review

/api/life/dashboard
  GET    - Aggregated dashboard data
```

---

## Database Indexes for Performance

```prisma
// Already included above, but highlighting:
@@index([userId, pillar])     // Vision, Identity
@@index([userId, date])       // RitualEntry
@@index([userId])             // Most user-owned tables
@@index([northStarId])        // Milestone
@@index([habitId, date])      // HabitCompletion
```
