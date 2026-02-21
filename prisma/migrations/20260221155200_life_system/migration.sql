-- CreateEnum
CREATE TYPE "Pillar" AS ENUM ('HEALTH', 'WEALTH', 'RELATIONSHIPS', 'CAREER', 'SPIRITUAL', 'CONTRIBUTION');

-- CreateEnum
CREATE TYPE "TimeHorizon" AS ENUM ('ONE_YEAR', 'THREE_YEAR', 'FIVE_YEAR', 'SOMEDAY');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Task" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "energyLevel" TEXT;
ALTER TABLE "Task" ADD COLUMN "northStarId" TEXT;
ALTER TABLE "Task" ADD COLUMN "timeEstimate" INTEGER;

-- CreateTable
CREATE TABLE "Vision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "horizon" "TimeHorizon" NOT NULL DEFAULT 'SOMEDAY',
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NorthStar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "achieved" BOOLEAN NOT NULL DEFAULT false,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NorthStar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "northStarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RitualEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "gratitude1" TEXT,
    "gratitude2" TEXT,
    "gratitude3" TEXT,
    "gratitude4" TEXT,
    "gratitude5" TEXT,
    "proud1" TEXT,
    "proud2" TEXT,
    "proud3" TEXT,
    "proud4" TEXT,
    "proud5" TEXT,
    "identity" TEXT,
    "wins" TEXT,
    "reflection" TEXT,
    "northStarReviewed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RitualEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pillar" "Pillar" NOT NULL,
    "statement" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitCompletion" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityProof" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifeScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "healthScore" INTEGER,
    "wealthScore" INTEGER,
    "relationScore" INTEGER,
    "careerScore" INTEGER,
    "spiritualScore" INTEGER,
    "contributionScore" INTEGER,
    "overallScore" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "wins" TEXT,
    "insights" TEXT,
    "adjustments" TEXT,
    "nextFocus" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifeSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "morningRitualTime" TEXT,
    "eveningRitualTime" TEXT,
    "weeklyReviewDay" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_northStarId_idx" ON "Task"("northStarId");

-- CreateIndex
CREATE INDEX "Vision_userId_pillar_idx" ON "Vision"("userId", "pillar");

-- CreateIndex
CREATE INDEX "NorthStar_userId_pillar_active_idx" ON "NorthStar"("userId", "pillar", "active");

-- CreateIndex
CREATE INDEX "NorthStar_userId_idx" ON "NorthStar"("userId");

-- CreateIndex
CREATE INDEX "Milestone_northStarId_idx" ON "Milestone"("northStarId");

-- CreateIndex
CREATE INDEX "RitualEntry_userId_date_idx" ON "RitualEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RitualEntry_userId_date_type_key" ON "RitualEntry"("userId", "date", "type");

-- CreateIndex
CREATE INDEX "Identity_userId_pillar_idx" ON "Identity"("userId", "pillar");

-- CreateIndex
CREATE INDEX "Habit_identityId_idx" ON "Habit"("identityId");

-- CreateIndex
CREATE INDEX "HabitCompletion_habitId_date_idx" ON "HabitCompletion"("habitId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCompletion_habitId_date_key" ON "HabitCompletion"("habitId", "date");

-- CreateIndex
CREATE INDEX "IdentityProof_identityId_idx" ON "IdentityProof"("identityId");

-- CreateIndex
CREATE INDEX "LifeScore_userId_idx" ON "LifeScore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LifeScore_userId_weekStart_key" ON "LifeScore"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyReview_userId_idx" ON "WeeklyReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_weekStart_key" ON "WeeklyReview"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "LifeSettings_userId_key" ON "LifeSettings"("userId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_northStarId_fkey" FOREIGN KEY ("northStarId") REFERENCES "NorthStar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vision" ADD CONSTRAINT "Vision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NorthStar" ADD CONSTRAINT "NorthStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_northStarId_fkey" FOREIGN KEY ("northStarId") REFERENCES "NorthStar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RitualEntry" ADD CONSTRAINT "RitualEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityProof" ADD CONSTRAINT "IdentityProof_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifeScore" ADD CONSTRAINT "LifeScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifeSettings" ADD CONSTRAINT "LifeSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
