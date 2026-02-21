"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Pillar, TimeHorizon, PILLAR_CONFIG } from "@/types";

// Journey stages
type Stage =
  | "intro"
  | "wake-up"
  | "four-modes"
  | "which-mode"
  | "navigator-path"
  | "gratitude-intro"
  | "gratitude"
  | "pride-intro"
  | "pride"
  | "pillars-intro"
  | "vision-health"
  | "vision-wealth"
  | "vision-relationships"
  | "vision-career"
  | "vision-spiritual"
  | "vision-contribution"
  | "northstar-intro"
  | "northstar"
  | "identity-intro"
  | "identity"
  | "ritual-intro"
  | "ritual-setup"
  | "tactical-intro"
  | "oath"
  | "complete";

interface VisionInput {
  pillar: Pillar;
  title: string;
  horizon: TimeHorizon;
}

const PILLAR_QUESTIONS: Record<Pillar, { title: string; question: string; prompt: string; examples: string[] }> = {
  HEALTH: {
    title: "Health & Vitality",
    question: "What does your ideal body and energy feel like?",
    prompt: "Close your eyes. Imagine waking up in your ideal state of health. How do you feel? What can you do? What does your body look like?",
    examples: ["Boundless energy every day", "Run a marathon", "34-inch waist", "Sleep 8 hours naturally"],
  },
  WEALTH: {
    title: "Wealth & Abundance",
    question: "What does true abundance mean to you?",
    prompt: "Money is a tool. When you have enough, what does life look like? What do you own? What experiences do you have? What worries disappear?",
    examples: ["$1M in savings", "Passive income exceeds expenses", "Own a beach house", "First class everywhere"],
  },
  RELATIONSHIPS: {
    title: "Relationships & Love",
    question: "Who do you want to be for the people you love?",
    prompt: "Think about the people who matter most. Your partner, children, parents, friends. What kind of presence do you want to be in their lives?",
    examples: ["Weekly date nights", "Present at every game", "Call mom every Sunday", "Deep friendships, not just contacts"],
  },
  CAREER: {
    title: "Career & Impact",
    question: "What mark will you leave on the world?",
    prompt: "Your work is how you serve. What will you build? What problems will you solve? How will people's lives be better because of what you created?",
    examples: ["Build a $10M company", "Employ 50 people", "Change an industry", "Become the go-to expert"],
  },
  SPIRITUAL: {
    title: "Spiritual & Growth",
    question: "What gives your life deeper meaning?",
    prompt: "Beyond success and achievement, what nourishes your soul? What practices center you? What beliefs guide you? Who are you becoming internally?",
    examples: ["Meditate daily", "Deeper faith practice", "Inner peace regardless of circumstances", "Read 50 books a year"],
  },
  CONTRIBUTION: {
    title: "Contribution & Legacy",
    question: "What legacy will you leave behind?",
    prompt: "One day, you'll be gone. What will remain? Who will you have helped? What will people say about the impact you made?",
    examples: ["Mentor 10 founders", "Fund scholarships", "Build something that outlasts me", "Change one life completely"],
  },
};

export default function OnboardingJourney() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  const [fadeIn, setFadeIn] = useState(true);
  const [saving, setSaving] = useState(false);

  // Journey data
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [gratitude, setGratitude] = useState(["", "", "", "", ""]);
  const [pride, setPride] = useState(["", "", "", "", ""]);
  const [visions, setVisions] = useState<VisionInput[]>([]);
  const [currentVisionInputs, setCurrentVisionInputs] = useState(["", "", ""]);
  const [northStars, setNorthStars] = useState<Record<Pillar, string>>({
    HEALTH: "",
    WEALTH: "",
    RELATIONSHIPS: "",
    CAREER: "",
    SPIRITUAL: "",
    CONTRIBUTION: "",
  });
  const [identities, setIdentities] = useState<Record<Pillar, string>>({
    HEALTH: "",
    WEALTH: "",
    RELATIONSHIPS: "",
    CAREER: "",
    SPIRITUAL: "",
    CONTRIBUTION: "",
  });
  const [ritualTimes, setRitualTimes] = useState({ morning: "07:00", evening: "21:00" });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const transition = useCallback((nextStage: Stage) => {
    setFadeIn(false);
    setTimeout(() => {
      setStage(nextStage);
      setFadeIn(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 500);
  }, []);

  const getCurrentPillar = (): Pillar | null => {
    const pillarStages: Record<string, Pillar> = {
      "vision-health": "HEALTH",
      "vision-wealth": "WEALTH",
      "vision-relationships": "RELATIONSHIPS",
      "vision-career": "CAREER",
      "vision-spiritual": "SPIRITUAL",
      "vision-contribution": "CONTRIBUTION",
    };
    return pillarStages[stage] || null;
  };

  const getNextVisionStage = (): Stage => {
    const order: Stage[] = [
      "vision-health",
      "vision-wealth",
      "vision-relationships",
      "vision-career",
      "vision-spiritual",
      "vision-contribution",
    ];
    const currentIndex = order.indexOf(stage as Stage);
    if (currentIndex < order.length - 1) {
      return order[currentIndex + 1];
    }
    return "northstar-intro";
  };

  const handleVisionNext = () => {
    const pillar = getCurrentPillar();
    if (!pillar) return;

    const newVisions = currentVisionInputs
      .filter((v) => v.trim())
      .map((title) => ({
        pillar,
        title: title.trim(),
        horizon: "SOMEDAY" as TimeHorizon,
      }));

    setVisions([...visions, ...newVisions]);
    setCurrentVisionInputs(["", "", ""]);
    transition(getNextVisionStage());
  };

  const getVisionsForPillar = (pillar: Pillar) => {
    return visions.filter((v) => v.pillar === pillar);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Save visions
      for (const vision of visions) {
        await fetch("/api/life/visions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vision),
        });
      }

      // Save North Stars
      for (const [pillar, title] of Object.entries(northStars)) {
        if (title) {
          await fetch("/api/life/north-stars", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pillar, title, active: true }),
          });
        }
      }

      // Save Identities
      for (const [pillar, statement] of Object.entries(identities)) {
        if (statement) {
          await fetch("/api/life/identities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pillar, statement }),
          });
        }
      }

      // Save settings
      await fetch("/api/life/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingCompleted: true,
          onboardingStep: 100,
          morningRitualTime: ritualTimes.morning,
          eveningRitualTime: ritualTimes.evening,
        }),
      });

      transition("complete");
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const firstName = session?.user?.name?.split(" ")[0] || "Navigator";

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white/40">Preparing your journey...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-y-auto">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div
        className={`relative z-10 transition-all duration-500 ${
          fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* INTRO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <div className="text-6xl mb-8 animate-pulse">🧭</div>
              <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                The Navigator&apos;s Journey
              </h1>
              <p className="text-xl text-white/60 mb-4 leading-relaxed">
                This is not a setup wizard.
              </p>
              <p className="text-xl text-white/60 mb-12 leading-relaxed">
                This is a journey to design your life with intention.
              </p>
              <p className="text-white/40 mb-12">
                Set aside 15-20 minutes. Find a quiet space.<br />
                What you discover here will guide your next 12 months.
              </p>
              <button
                onClick={() => transition("wake-up")}
                className="px-12 py-5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-2xl text-lg font-medium transition-all hover:scale-105 hover:shadow-xl hover:shadow-violet-500/20"
              >
                Begin the Journey
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* THE WAKE-UP CALL */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "wake-up" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl">
              <p className="text-violet-400 text-sm uppercase tracking-widest mb-8">
                Act I: The Wake-Up Call
              </p>
              <h2 className="text-4xl font-bold mb-8 leading-tight">
                Most entrepreneurs are building empires on shaky foundations.
              </h2>
              <div className="space-y-6 text-lg text-white/70 leading-relaxed">
                <p>
                  They crush it at work. Revenue grows. Teams expand. The business thrives.
                </p>
                <p>
                  But at 2 AM, staring at the ceiling, something feels off.
                </p>
                <p>
                  Health declining. Relationships strained. That nagging sense that success isn&apos;t supposed to feel this... hollow.
                </p>
                <p className="text-white font-medium">
                  Sound familiar?
                </p>
              </div>
              <button
                onClick={() => transition("four-modes")}
                className="mt-12 px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* THE FOUR MODES */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "four-modes" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-3xl">
              <p className="text-violet-400 text-sm uppercase tracking-widest mb-8">
                The Four Modes of Living
              </p>
              <h2 className="text-4xl font-bold mb-12">
                There are four ways to move through life:
              </h2>
              <div className="grid gap-6">
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-3xl">🌊</span>
                    <h3 className="text-2xl font-bold text-red-400">Drowning</h3>
                  </div>
                  <p className="text-white/60">
                    Overwhelmed. Reactive. Every day is survival. No time to think, only to respond. Exhaustion is the norm.
                  </p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-3xl">🍂</span>
                    <h3 className="text-2xl font-bold text-amber-400">Drifting</h3>
                  </div>
                  <p className="text-white/60">
                    Comfortable but directionless. Going with the flow. Life happens TO you. Years pass without intention.
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-3xl">🏄</span>
                    <h3 className="text-2xl font-bold text-blue-400">Surfing</h3>
                  </div>
                  <p className="text-white/60">
                    Riding waves. Opportunistic. Exciting, but no destination. You catch what comes, but never choose the shore.
                  </p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-3xl">🧭</span>
                    <h3 className="text-2xl font-bold text-emerald-400">Navigating</h3>
                  </div>
                  <p className="text-white/60">
                    Charting a course. Intentional. You choose the destination, adjust for conditions, and move with purpose.
                  </p>
                </div>
              </div>
              <button
                onClick={() => transition("which-mode")}
                className="mt-12 px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* WHICH MODE ARE YOU? */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "which-mode" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <p className="text-violet-400 text-sm uppercase tracking-widest mb-8">
                Honest Reflection
              </p>
              <h2 className="text-4xl font-bold mb-4">
                Be honest with yourself.
              </h2>
              <p className="text-xl text-white/60 mb-12">
                Which mode have you been living in lately?
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
                {[
                  { id: "drowning", emoji: "🌊", label: "Drowning", color: "red" },
                  { id: "drifting", emoji: "🍂", label: "Drifting", color: "amber" },
                  { id: "surfing", emoji: "🏄", label: "Surfing", color: "blue" },
                  { id: "navigating", emoji: "🧭", label: "Navigating", color: "emerald" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`p-6 rounded-2xl border-2 transition-all ${
                      selectedMode === mode.id
                        ? `bg-${mode.color}-500/20 border-${mode.color}-500`
                        : "bg-white/5 border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className="text-4xl mb-2">{mode.emoji}</div>
                    <div className="font-medium">{mode.label}</div>
                  </button>
                ))}
              </div>
              {selectedMode && (
                <button
                  onClick={() => transition("navigator-path")}
                  className="mt-12 px-8 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-xl transition-all"
                >
                  Continue →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* THE NAVIGATOR'S PATH */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "navigator-path" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl">
              <p className="text-violet-400 text-sm uppercase tracking-widest mb-8">
                The Navigator&apos;s Path
              </p>
              {selectedMode !== "navigating" ? (
                <>
                  <h2 className="text-4xl font-bold mb-8 leading-tight">
                    That&apos;s okay. Most of us have been there.
                  </h2>
                  <div className="space-y-6 text-lg text-white/70 leading-relaxed">
                    <p>
                      The good news? Today you make a different choice.
                    </p>
                    <p>
                      Today, you become a <span className="text-emerald-400 font-semibold">Navigator</span>.
                    </p>
                    <p>
                      Someone who charts their own course. Who designs their life intentionally. Who knows where they&apos;re going and why.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-bold mb-8 leading-tight">
                    Excellent. You already think like a Navigator.
                  </h2>
                  <div className="space-y-6 text-lg text-white/70 leading-relaxed">
                    <p>
                      But even the best navigators need to update their charts.
                    </p>
                    <p>
                      What got you here won&apos;t get you there.
                    </p>
                    <p>
                      Let&apos;s recalibrate your compass for the journey ahead.
                    </p>
                  </div>
                </>
              )}
              <div className="mt-12 p-6 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-white/80 italic">
                  &ldquo;What the mind can conceive and believe, it can achieve.&rdquo;
                </p>
                <p className="text-white/40 text-sm mt-2">— Napoleon Hill</p>
              </div>
              <button
                onClick={() => transition("gratitude-intro")}
                className="mt-12 px-8 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-xl transition-all"
              >
                Let&apos;s Begin →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* GRATITUDE INTRO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "gratitude-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <p className="text-amber-400 text-sm uppercase tracking-widest mb-8">
                Act II: Grounding
              </p>
              <div className="text-6xl mb-8">🙏</div>
              <h2 className="text-4xl font-bold mb-8">
                Before we dream forward,<br />let&apos;s honor the present.
              </h2>
              <p className="text-xl text-white/60 leading-relaxed">
                Gratitude isn&apos;t just positive thinking. It&apos;s grounding. It reminds you that you&apos;re not starting from zero. You have a foundation.
              </p>
              <button
                onClick={() => transition("gratitude")}
                className="mt-12 px-8 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* GRATITUDE */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "gratitude" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <p className="text-amber-400 text-sm uppercase tracking-widest mb-4">
                Gratitude
              </p>
              <h2 className="text-3xl font-bold mb-4">
                What are five things you&apos;re genuinely grateful for?
              </h2>
              <p className="text-white/60 mb-8">
                Not what you think you should say. What actually fills you with gratitude when you pause to notice it.
              </p>
              <div className="space-y-4">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-medium">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={gratitude[idx]}
                      onChange={(e) => {
                        const updated = [...gratitude];
                        updated[idx] = e.target.value;
                        setGratitude(updated);
                      }}
                      placeholder="I'm grateful for..."
                      className="flex-1 px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => transition("pride-intro")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl transition-all font-medium"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PRIDE INTRO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "pride-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <div className="text-6xl mb-8">💪</div>
              <h2 className="text-4xl font-bold mb-8">
                Now, acknowledge your power.
              </h2>
              <p className="text-xl text-white/60 leading-relaxed mb-6">
                You have accomplished things. You have overcome obstacles. You have proof that you can achieve.
              </p>
              <p className="text-lg text-white/40">
                This isn&apos;t arrogance. It&apos;s evidence.
              </p>
              <button
                onClick={() => transition("pride")}
                className="mt-12 px-8 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PRIDE */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "pride" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <p className="text-amber-400 text-sm uppercase tracking-widest mb-4">
                Pride
              </p>
              <h2 className="text-3xl font-bold mb-4">
                What are five things you&apos;re genuinely proud of about yourself?
              </h2>
              <p className="text-white/60 mb-8">
                Accomplishments, qualities, moments when you showed up as your best self.
              </p>
              <div className="space-y-4">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-medium">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={pride[idx]}
                      onChange={(e) => {
                        const updated = [...pride];
                        updated[idx] = e.target.value;
                        setPride(updated);
                      }}
                      placeholder="I'm proud that I..."
                      className="flex-1 px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => transition("pillars-intro")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl transition-all font-medium"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PILLARS INTRO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "pillars-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-3xl text-center">
              <p className="text-violet-400 text-sm uppercase tracking-widest mb-8">
                Act III: Vision
              </p>
              <h2 className="text-4xl font-bold mb-8">
                A life is not just a business.
              </h2>
              <p className="text-xl text-white/60 leading-relaxed mb-12">
                True success is a balanced wheel, not a single spoke. We&apos;ll explore six pillars of a complete life.
              </p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-12">
                {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => (
                  <div
                    key={pillar}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10"
                  >
                    <div className="text-3xl mb-2">{config.emoji}</div>
                    <div className="text-sm text-white/60">{config.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-white/40 mb-8">
                For each pillar, you&apos;ll answer one question:<br />
                <span className="text-white font-medium">&ldquo;What do I really want?&rdquo;</span>
              </p>
              <p className="text-white/40 italic">
                No justification needed. No &ldquo;how&rdquo; required. Just honest desire.
              </p>
              <button
                onClick={() => transition("vision-health")}
                className="mt-12 px-8 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-xl transition-all"
              >
                Begin Dreaming →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* VISION STAGES (per pillar) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {[
          "vision-health",
          "vision-wealth",
          "vision-relationships",
          "vision-career",
          "vision-spiritual",
          "vision-contribution",
        ].includes(stage) && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            {(() => {
              const pillar = getCurrentPillar()!;
              const config = PILLAR_CONFIG[pillar];
              const questions = PILLAR_QUESTIONS[pillar];
              return (
                <div className="max-w-2xl w-full">
                  <div className="flex items-center gap-4 mb-8">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                      style={{ backgroundColor: config.color + "20" }}
                    >
                      {config.emoji}
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-widest\" style={{ color: config.color }}>
                        {questions.title}
                      </p>
                      <h2 className="text-3xl font-bold">{questions.question}</h2>
                    </div>
                  </div>
                  <p className="text-white/60 mb-8 leading-relaxed">
                    {questions.prompt}
                  </p>
                  <div className="space-y-4 mb-6">
                    {[0, 1, 2].map((idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={currentVisionInputs[idx]}
                        onChange={(e) => {
                          const updated = [...currentVisionInputs];
                          updated[idx] = e.target.value;
                          setCurrentVisionInputs(updated);
                        }}
                        placeholder={idx === 0 ? `e.g., ${questions.examples[0]}` : "Another vision..."}
                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none transition-colors"
                        style={{ borderColor: currentVisionInputs[idx] ? config.color + "50" : undefined }}
                      />
                    ))}
                  </div>
                  <p className="text-white/30 text-sm mb-8">
                    Ideas: {questions.examples.join(" • ")}
                  </p>
                  <button
                    onClick={handleVisionNext}
                    className="w-full py-4 rounded-xl transition-all font-medium"
                    style={{ background: `linear-gradient(to right, ${config.color}, ${config.color}dd)` }}
                  >
                    Continue →
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* NORTH STAR INTRO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "northstar-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <p className="text-cyan-400 text-sm uppercase tracking-widest mb-8">
                Act IV: Focus
              </p>
              <div className="text-6xl mb-8">⭐</div>
              <h2 className="text-4xl font-bold mb-8">
                Dreams are infinite.<br />Time is not.
              </h2>
              <p className="text-xl text-white/60 leading-relaxed mb-8">
                From everything you just envisioned, you&apos;ll now select <span className="text-white font-semibold">one goal per pillar</span> for the next 12 months.
              </p>
              <p className="text-lg text-white/40 mb-8">
                This becomes your <span className="text-cyan-400">North Star</span> — the guiding light you&apos;ll review every morning and evening.
              </p>
              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 mb-8">
                <p className="text-white/60 italic text-sm">
                  &ldquo;The secret of getting ahead is getting started. The secret of getting started is breaking your complex overwhelming tasks into small manageable tasks, and starting on the first one.&rdquo;
                </p>
                <p className="text-white/40 text-xs mt-2">— Mark Twain</p>
              </div>
              <button
                onClick={() => transition("northstar")}
                className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-xl transition-all"
              >
                Choose My North Star →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* NORTH STAR SELECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "northstar" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <p className="text-cyan-400 text-sm uppercase tracking-widest mb-4">
                Your North Star
              </p>
              <h2 className="text-3xl font-bold mb-2">
                One goal per pillar. 12 months.
              </h2>
              <p className="text-white/60 mb-8">
                Pick from your visions or write something new. Make it specific and compelling.
              </p>
              <div className="space-y-4">
                {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => {
                  const pillarVisions = getVisionsForPillar(pillar as Pillar);
                  return (
                    <div key={pillar} className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{config.emoji}</span>
                        <span className="font-medium">{config.label}</span>
                      </div>
                      {pillarVisions.length > 0 ? (
                        <select
                          value={northStars[pillar as Pillar]}
                          onChange={(e) =>
                            setNorthStars({ ...northStars, [pillar]: e.target.value })
                          }
                          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
                        >
                          <option value="">Select your 12-month goal...</option>
                          {pillarVisions.map((v, idx) => (
                            <option key={idx} value={v.title}>
                              {v.title}
                            </option>
                          ))}
                          <option value="__custom__">✏️ Write my own...</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={northStars[pillar as Pillar]}
                          onChange={(e) =>
                            setNorthStars({ ...northStars, [pillar]: e.target.value })
                          }
                          placeholder={`My ${config.label.toLowerCase()} goal for this year...`}
                          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                        />
                      )}
                      {northStars[pillar as Pillar] === "__custom__" && (
                        <input
                          type="text"
                          onChange={(e) =>
                            setNorthStars({ ...northStars, [pillar]: e.target.value })
                          }
                          placeholder={`Write your ${config.label.toLowerCase()} goal...`}
                          className="w-full mt-2 px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                          autoFocus
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => transition("identity-intro")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-xl transition-all font-medium"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* IDENTITY INTRO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "identity-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <p className="text-purple-400 text-sm uppercase tracking-widest mb-8">
                Act V: Identity
              </p>
              <div className="text-6xl mb-8">🦋</div>
              <h2 className="text-4xl font-bold mb-8">
                Goals are what you want.<br />Identity is who you become.
              </h2>
              <p className="text-xl text-white/60 leading-relaxed mb-8">
                The deepest level of change is identity change. When you shift who you <em>are</em>, behaviors follow naturally.
              </p>
              <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-left mb-8">
                <p className="text-white/80 mb-4">Instead of:</p>
                <p className="text-white/40 mb-4">&ldquo;I want to exercise more&rdquo;</p>
                <p className="text-white/80 mb-4">Declare:</p>
                <p className="text-purple-400 font-medium">&ldquo;I am a person who takes care of my body daily&rdquo;</p>
              </div>
              <p className="text-white/40 italic">
                Every action becomes a vote for the person you&apos;re becoming.
              </p>
              <button
                onClick={() => transition("identity")}
                className="mt-12 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl transition-all"
              >
                Define Who I Am →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* IDENTITY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "identity" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <p className="text-purple-400 text-sm uppercase tracking-widest mb-4">
                Identity Statements
              </p>
              <h2 className="text-3xl font-bold mb-2">
                Who must you become to achieve your North Star?
              </h2>
              <p className="text-white/60 mb-8">
                Complete: &ldquo;I am a person who...&rdquo;
              </p>
              <div className="space-y-4">
                {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => (
                  <div key={pillar} className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">{config.emoji}</span>
                      <span className="text-white/60 text-sm">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 whitespace-nowrap">I am a person who</span>
                      <input
                        type="text"
                        value={identities[pillar as Pillar]}
                        onChange={(e) =>
                          setIdentities({ ...identities, [pillar]: e.target.value })
                        }
                        placeholder="..."
                        className="flex-1 px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => transition("ritual-intro")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl transition-all font-medium"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* RITUAL INTRO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "ritual-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <p className="text-rose-400 text-sm uppercase tracking-widest mb-8">
                Act VI: Commitment
              </p>
              <div className="text-6xl mb-8">🔥</div>
              <h2 className="text-4xl font-bold mb-8">
                Knowledge without practice is useless.
              </h2>
              <p className="text-xl text-white/60 leading-relaxed mb-8">
                The magic isn&apos;t in knowing your North Star. It&apos;s in programming it into your subconscious through daily repetition.
              </p>
              <div className="grid md:grid-cols-2 gap-6 text-left mb-8">
                <div className="bg-amber-500/10 rounded-2xl p-6 border border-amber-500/20">
                  <div className="text-3xl mb-3">☀️</div>
                  <h3 className="text-xl font-bold text-amber-400 mb-2">Morning Ritual</h3>
                  <p className="text-white/60 text-sm">
                    Start your day with gratitude, pride, and a review of your North Star. Program your intention.
                  </p>
                </div>
                <div className="bg-indigo-500/10 rounded-2xl p-6 border border-indigo-500/20">
                  <div className="text-3xl mb-3">🌙</div>
                  <h3 className="text-xl font-bold text-indigo-400 mb-2">Evening Ritual</h3>
                  <p className="text-white/60 text-sm">
                    End your day reflecting on wins and reviewing your goals. Let your subconscious work while you sleep.
                  </p>
                </div>
              </div>
              <button
                onClick={() => transition("ritual-setup")}
                className="px-8 py-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 rounded-xl transition-all"
              >
                Set My Ritual Times →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* RITUAL SETUP */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "ritual-setup" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-md w-full text-center">
              <p className="text-rose-400 text-sm uppercase tracking-widest mb-4">
                Daily Commitment
              </p>
              <h2 className="text-3xl font-bold mb-8">
                When will you practice?
              </h2>
              <div className="space-y-6">
                <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">☀️</span>
                      <span className="font-medium">Morning Ritual</span>
                    </div>
                    <span className="text-white/40 text-sm">~10 min</span>
                  </div>
                  <input
                    type="time"
                    value={ritualTimes.morning}
                    onChange={(e) => setRitualTimes({ ...ritualTimes, morning: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white text-center text-xl focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="p-6 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🌙</span>
                      <span className="font-medium">Evening Ritual</span>
                    </div>
                    <span className="text-white/40 text-sm">~5 min</span>
                  </div>
                  <input
                    type="time"
                    value={ritualTimes.evening}
                    onChange={(e) => setRitualTimes({ ...ritualTimes, evening: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white text-center text-xl focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
              <button
                onClick={() => transition("oath")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 rounded-xl transition-all font-medium"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* THE NAVIGATOR'S OATH */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "oath" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <p className="text-emerald-400 text-sm uppercase tracking-widest mb-8">
                Act VII: Launch
              </p>
              <div className="text-6xl mb-8">🧭</div>
              <h2 className="text-4xl font-bold mb-8">
                The Navigator&apos;s Oath
              </h2>
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-2xl p-8 border border-emerald-500/20 mb-8 text-left">
                <p className="text-xl text-white/90 leading-relaxed mb-6">
                  I, <span className="text-emerald-400 font-semibold">{firstName}</span>, choose to be a Navigator.
                </p>
                <p className="text-white/70 leading-relaxed mb-4">
                  I will not drift through life waiting for direction.
                </p>
                <p className="text-white/70 leading-relaxed mb-4">
                  I will not drown in busyness without purpose.
                </p>
                <p className="text-white/70 leading-relaxed mb-4">
                  I will not merely surf from opportunity to opportunity.
                </p>
                <p className="text-white/90 leading-relaxed font-medium">
                  I will chart my course. I will review it daily. I will become the person my North Star requires.
                </p>
              </div>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="px-12 py-5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 rounded-2xl text-lg font-medium transition-all hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                {saving ? "Launching..." : "I Am a Navigator ✨"}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* COMPLETE */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {stage === "complete" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center">
              <div className="text-8xl mb-8 animate-bounce">🎉</div>
              <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Welcome, Navigator.
              </h2>
              <p className="text-xl text-white/60 mb-12">
                Your journey has begun. Your North Star is set. Your identity is declared.
              </p>
              <div className="bg-white/5 rounded-2xl p-8 border border-white/10 mb-8 text-left">
                <h3 className="text-lg font-semibold mb-4">Your Daily Practice:</h3>
                <div className="space-y-3 text-white/70">
                  <div className="flex items-center gap-3">
                    <span>☀️</span>
                    <span>Morning ritual at {ritualTimes.morning}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>🌙</span>
                    <span>Evening ritual at {ritualTimes.evening}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>📝</span>
                    <span>Weekly review every Sunday</span>
                  </div>
                </div>
              </div>
              <p className="text-2xl text-white/80 italic mb-12">
                &ldquo;Dream. Believe. Achieve.&rdquo;
              </p>
              <button
                onClick={() => router.push("/life")}
                className="px-12 py-5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-2xl text-lg font-medium transition-all hover:scale-105"
              >
                Enter the Life System →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
