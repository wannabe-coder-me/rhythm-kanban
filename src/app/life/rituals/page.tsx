"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RitualEntry } from "@/types";

export default function RitualsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [morningRitual, setMorningRitual] = useState<RitualEntry | null>(null);
  const [eveningRitual, setEveningRitual] = useState<RitualEntry | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchRituals();
    }
  }, [session]);

  const fetchRituals = async () => {
    try {
      const res = await fetch("/api/life/rituals");
      if (res.ok) {
        const data = await res.json();
        setMorningRitual(data.find((r: RitualEntry) => r.type === "morning") || null);
        setEveningRitual(data.find((r: RitualEntry) => r.type === "evening") || null);
      }
    } catch (error) {
      console.error("Failed to fetch rituals:", error);
    } finally {
      setLoading(false);
    }
  };

  const hour = new Date().getHours();
  const isMorningTime = hour >= 5 && hour < 12;
  const isEveningTime = hour >= 18 || hour < 5;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12]">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/life" className="text-white/60 hover:text-white">
              ← Back
            </Link>
            <span className="text-xl font-semibold text-white">Daily Rituals</span>
          </div>
          <div className="text-white/40 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Intro */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-4">
            Program Your Mind for Success
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Daily rituals are how you communicate with your subconscious mind. 
            Through repetition and emotion, you program yourself for achievement.
          </p>
        </div>

        {/* Ritual Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Morning Ritual */}
          <div className={`relative overflow-hidden rounded-2xl border ${
            isMorningTime ? 'border-amber-400/50' : 'border-white/10'
          }`}>
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-transparent" />
            
            {/* Content */}
            <div className="relative p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-5xl">☀️</span>
                </div>
                {morningRitual?.completedAt ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                    ✓ Complete
                  </span>
                ) : isMorningTime ? (
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm animate-pulse">
                    Now is the time!
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-white/10 text-white/40 rounded-full text-sm">
                    Best: 6-9 AM
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Morning Ritual</h2>
              <p className="text-white/60 mb-6">
                Start your day with gratitude, pride, and intention. 
                Review your North Star with emotion.
              </p>

              <div className="space-y-2 mb-6 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">1</span>
                  <span>5 things you&apos;re grateful for</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">2</span>
                  <span>5 things you&apos;re proud of</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">3</span>
                  <span>Review North Star goals</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">4</span>
                  <span>Who must I become today?</span>
                </div>
              </div>

              <Link
                href="/life/rituals/morning"
                className={`block text-center py-3 rounded-xl font-semibold transition-all ${
                  morningRitual?.completedAt
                    ? 'bg-white/10 text-white/60 hover:bg-white/20'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400'
                }`}
              >
                {morningRitual?.completedAt ? 'Review Ritual' : 'Start Morning Ritual'}
              </Link>
            </div>
          </div>

          {/* Evening Ritual */}
          <div className={`relative overflow-hidden rounded-2xl border ${
            isEveningTime ? 'border-indigo-400/50' : 'border-white/10'
          }`}>
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-transparent" />
            
            {/* Stars */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-white rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    opacity: 0.2 + Math.random() * 0.3,
                  }}
                />
              ))}
            </div>
            
            {/* Content */}
            <div className="relative p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-5xl">🌙</span>
                </div>
                {eveningRitual?.completedAt ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                    ✓ Complete
                  </span>
                ) : isEveningTime ? (
                  <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm animate-pulse">
                    Now is the time!
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-white/10 text-white/40 rounded-full text-sm">
                    Best: 8-10 PM
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Evening Ritual</h2>
              <p className="text-white/60 mb-6">
                End your day celebrating wins, reviewing goals, 
                and planning tomorrow.
              </p>

              <div className="space-y-2 mb-6 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs">1</span>
                  <span>What went well today?</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs">2</span>
                  <span>Review North Star before sleep</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs">3</span>
                  <span>Reflect and plan tomorrow</span>
                </div>
              </div>

              <Link
                href="/life/rituals/evening"
                className={`block text-center py-3 rounded-xl font-semibold transition-all ${
                  eveningRitual?.completedAt
                    ? 'bg-white/10 text-white/60 hover:bg-white/20'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400'
                }`}
              >
                {eveningRitual?.completedAt ? 'Review Ritual' : 'Start Evening Ritual'}
              </Link>
            </div>
          </div>
        </div>

        {/* Quote */}
        <div className="mt-12 text-center p-8 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-xl text-white/80 italic mb-2">
            &ldquo;The subconscious mind works 24/7. Feed it well in the morning, 
            reinforce at night, and watch your life transform.&rdquo;
          </p>
          <p className="text-violet-400">— The Navigator&apos;s Way</p>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-2xl font-bold text-amber-400">☀️</div>
            <div className="text-white/60 text-sm mt-1">Morning</div>
            <div className="text-white font-semibold">
              {morningRitual?.completedAt ? '✓' : '—'}
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-2xl font-bold text-indigo-400">🌙</div>
            <div className="text-white/60 text-sm mt-1">Evening</div>
            <div className="text-white font-semibold">
              {eveningRitual?.completedAt ? '✓' : '—'}
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-2xl font-bold text-orange-400">🔥</div>
            <div className="text-white/60 text-sm mt-1">Streak</div>
            <div className="text-white font-semibold">—</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-2xl font-bold text-green-400">📈</div>
            <div className="text-white/60 text-sm mt-1">This Week</div>
            <div className="text-white font-semibold">—/14</div>
          </div>
        </div>
      </main>
    </div>
  );
}
