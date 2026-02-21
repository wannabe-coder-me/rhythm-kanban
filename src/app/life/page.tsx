"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LifeDashboard, PILLAR_CONFIG, NorthStar } from "@/types";
import Link from "next/link";

export default function LifeDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<LifeDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchDashboard();
    }
  }, [session]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/life/dashboard");
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const calculateOverallScore = () => {
    if (!dashboard?.lifeScore) return null;
    const scores = [
      dashboard.lifeScore.healthScore,
      dashboard.lifeScore.wealthScore,
      dashboard.lifeScore.relationScore,
      dashboard.lifeScore.careerScore,
      dashboard.lifeScore.spiritualScore,
      dashboard.lifeScore.contributionScore,
    ].filter((s) => s !== null) as number[];
    
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  // Check if onboarding needed
  if (dashboard && !dashboard.onboardingComplete) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-6">🧭</div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Welcome to the Life System
          </h1>
          <p className="text-white/60 mb-8">
            &ldquo;What the mind can conceive and believe, it can achieve.&rdquo;
          </p>
          <p className="text-white/80 mb-8">
            Let&apos;s set up your vision and North Star goals. This will take about 5 minutes.
          </p>
          <Link
            href="/life/onboarding"
            className="inline-block px-8 py-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-colors"
          >
            Begin Setup →
          </Link>
        </div>
      </div>
    );
  }

  const overallScore = calculateOverallScore();
  const firstName = session?.user?.name?.split(" ")[0] || "Navigator";

  return (
    <div className="min-h-screen bg-[#0a0a12] overflow-y-auto">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧭</span>
            <span className="text-xl font-semibold text-white">Life System</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/life" className="text-white font-medium">Dashboard</Link>
            <Link href="/life/north-star" className="text-white/60 hover:text-white">North Star</Link>
            <Link href="/life/vision" className="text-white/60 hover:text-white">Vision</Link>
            <Link href="/life/rituals" className="text-white/60 hover:text-white">Rituals</Link>
            <Link href="/" className="text-white/60 hover:text-white">Boards</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-white/50 italic">
            &ldquo;Dream. Believe. Achieve.&rdquo;
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Life Score Card */}
          <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Life Score</h2>
            <div className="text-center">
              <div className="text-5xl font-bold text-violet-400 mb-2">
                {overallScore ?? "—"}
              </div>
              <p className="text-white/50 text-sm mb-4">Overall Score</p>
              
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => {
                  const score = dashboard?.lifeScore?.[
                    `${pillar.toLowerCase()}Score` as keyof typeof dashboard.lifeScore
                  ];
                  return (
                    <div key={pillar} className="text-center">
                      <div className="text-lg">{config.emoji}</div>
                      <div className="text-white/80">{typeof score === 'number' ? score * 10 : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Link
              href="/life/score"
              className="block mt-4 text-center text-sm text-violet-400 hover:text-violet-300"
            >
              View Details →
            </Link>
          </div>

          {/* Today's Focus */}
          <div className="lg:col-span-2 bg-[#1a1a2e] rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Today&apos;s Focus</h2>
            
            {/* Rituals */}
            <div className="space-y-3 mb-6">
              <Link
                href="/life/rituals/morning"
                className={`flex items-center justify-between p-3 rounded-xl ${
                  dashboard?.rituals.morning.completed
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">☀️</span>
                  <span className="text-white">Morning Ritual</span>
                </div>
                {dashboard?.rituals.morning.completed ? (
                  <span className="text-green-400 text-sm">✓ Complete</span>
                ) : (
                  <span className="text-white/50 text-sm">Start →</span>
                )}
              </Link>

              <Link
                href="/life/north-star"
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">⭐</span>
                  <span className="text-white">Review North Star</span>
                </div>
                <span className="text-white/50 text-sm">
                  {dashboard?.northStars.length || 0} goals
                </span>
              </Link>
            </div>

            {/* Today's Actions */}
            <h3 className="text-sm font-medium text-white/60 mb-3">
              Actions Today ({dashboard?.todaysActions.length || 0})
            </h3>
            <div className="space-y-2">
              {dashboard?.todaysActions.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    className="w-4 h-4 rounded border-white/30"
                    readOnly
                  />
                  <span className="text-white flex-1">{task.title}</span>
                  {task.northStar && (
                    <span
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: PILLAR_CONFIG[task.northStar.pillar].color + "20",
                        color: PILLAR_CONFIG[task.northStar.pillar].color,
                      }}
                    >
                      {PILLAR_CONFIG[task.northStar.pillar].emoji}
                    </span>
                  )}
                </div>
              ))}
              {(!dashboard?.todaysActions || dashboard.todaysActions.length === 0) && (
                <p className="text-white/40 text-sm py-4 text-center">
                  No actions scheduled for today
                </p>
              )}
            </div>
          </div>
        </div>

        {/* North Star Progress */}
        <div className="mt-6 bg-[#1a1a2e] rounded-2xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">North Star Progress</h2>
            <Link
              href="/life/north-star"
              className="text-sm text-violet-400 hover:text-violet-300"
            >
              Edit Goals →
            </Link>
          </div>

          <div className="space-y-4">
            {dashboard?.northStars.map((ns) => (
              <div key={ns.id} className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ backgroundColor: PILLAR_CONFIG[ns.pillar].color + "20" }}
                >
                  {PILLAR_CONFIG[ns.pillar].emoji}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium">{ns.title}</span>
                    <span className="text-white/60 text-sm">{ns.progress}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ns.progress}%`,
                        backgroundColor: PILLAR_CONFIG[ns.pillar].color,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {(!dashboard?.northStars || dashboard.northStars.length === 0) && (
              <div className="text-center py-8">
                <p className="text-white/40 mb-4">No North Star goals set yet</p>
                <Link
                  href="/life/north-star"
                  className="inline-block px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
                >
                  Set Your Goals →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Habit Streaks */}
        {dashboard?.habits && dashboard.habits.length > 0 && (
          <div className="mt-6 bg-[#1a1a2e] rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">🔥 Top Streaks</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {dashboard.habits.map((habit) => (
                <div
                  key={habit.id}
                  className="text-center p-3 rounded-xl bg-white/5"
                >
                  <div className="text-2xl mb-1">
                    {PILLAR_CONFIG[habit.pillar].emoji}
                  </div>
                  <div className="text-xl font-bold text-orange-400">
                    {habit.streak} 🔥
                  </div>
                  <div className="text-xs text-white/60 truncate">
                    {habit.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
