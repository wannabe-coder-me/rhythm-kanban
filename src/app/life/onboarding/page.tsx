"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { Pillar, TimeHorizon, PILLAR_CONFIG } from "@/types";

// ═══════════════════════════════════════════════════════════════════════════
// JOURNEY STAGES
// ═══════════════════════════════════════════════════════════════════════════

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
  | "oath"
  | "complete";

const STAGE_ORDER: Stage[] = [
  "intro", "wake-up", "four-modes", "which-mode", "navigator-path",
  "gratitude-intro", "gratitude", "pride-intro", "pride", "pillars-intro",
  "vision-health", "vision-wealth", "vision-relationships", "vision-career",
  "vision-spiritual", "vision-contribution", "northstar-intro", "northstar",
  "identity-intro", "identity", "ritual-intro", "ritual-setup", "oath", "complete"
];

const STAGE_LABELS: Partial<Record<Stage, string>> = {
  "intro": "Begin",
  "wake-up": "Wake Up",
  "four-modes": "Four Modes",
  "gratitude": "Gratitude",
  "pride": "Pride",
  "pillars-intro": "Six Pillars",
  "vision-health": "Health",
  "vision-wealth": "Wealth",
  "vision-relationships": "Love",
  "vision-career": "Career",
  "vision-spiritual": "Spirit",
  "vision-contribution": "Legacy",
  "northstar": "North Star",
  "identity": "Identity",
  "ritual-setup": "Rituals",
  "oath": "Oath",
  "complete": "Launch",
};

// ═══════════════════════════════════════════════════════════════════════════
// PILLAR CONFIG
// ═══════════════════════════════════════════════════════════════════════════

interface VisionInput {
  pillar: Pillar;
  title: string;
  horizon: TimeHorizon;
}

const PILLAR_QUESTIONS: Record<Pillar, { 
  title: string; 
  question: string; 
  prompt: string; 
  examples: string[];
  gradient: string;
}> = {
  HEALTH: {
    title: "Health & Vitality",
    question: "What does your ideal body and energy feel like?",
    prompt: "Close your eyes. Imagine waking up in your ideal state of health. How do you feel? What can you do?",
    examples: ["Boundless energy", "Run a marathon", "34-inch waist", "Sleep deeply"],
    gradient: "from-green-500 to-emerald-600",
  },
  WEALTH: {
    title: "Wealth & Abundance", 
    question: "What does true abundance mean to you?",
    prompt: "Money is a tool. When you have enough, what does life look like? What worries disappear?",
    examples: ["$1M saved", "Passive income", "Beach house", "First class"],
    gradient: "from-amber-500 to-orange-600",
  },
  RELATIONSHIPS: {
    title: "Relationships & Love",
    question: "Who do you want to be for the people you love?",
    prompt: "Think about those who matter most. What kind of presence do you want to be in their lives?",
    examples: ["Weekly dates", "Present parent", "Deep friendships", "Call family"],
    gradient: "from-rose-500 to-pink-600",
  },
  CAREER: {
    title: "Career & Impact",
    question: "What mark will you leave on the world?",
    prompt: "Your work is how you serve. What will you build? How will lives be better?",
    examples: ["$10M company", "Employ 50", "Change industry", "Go-to expert"],
    gradient: "from-blue-500 to-indigo-600",
  },
  SPIRITUAL: {
    title: "Spiritual & Growth",
    question: "What gives your life deeper meaning?",
    prompt: "Beyond achievement, what nourishes your soul? Who are you becoming internally?",
    examples: ["Meditate daily", "Deeper faith", "Inner peace", "50 books/year"],
    gradient: "from-purple-500 to-violet-600",
  },
  CONTRIBUTION: {
    title: "Contribution & Legacy",
    question: "What legacy will you leave behind?",
    prompt: "One day, you'll be gone. What will remain? What will people say about your impact?",
    examples: ["Mentor founders", "Fund education", "Outlast me", "Change lives"],
    gradient: "from-teal-500 to-cyan-600",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function OnboardingJourney() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("intro");
  const [fadeIn, setFadeIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Journey data
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [gratitude, setGratitude] = useState(["", "", "", "", ""]);
  const [pride, setPride] = useState(["", "", "", "", ""]);
  const [visions, setVisions] = useState<VisionInput[]>([]);
  const [currentVisionInputs, setCurrentVisionInputs] = useState(["", "", ""]);
  const [northStars, setNorthStars] = useState<Record<Pillar, string>>({
    HEALTH: "", WEALTH: "", RELATIONSHIPS: "", CAREER: "", SPIRITUAL: "", CONTRIBUTION: "",
  });
  const [identities, setIdentities] = useState<Record<Pillar, string>>({
    HEALTH: "", WEALTH: "", RELATIONSHIPS: "", CAREER: "", SPIRITUAL: "", CONTRIBUTION: "",
  });
  const [ritualTimes, setRitualTimes] = useState({ morning: "07:00", evening: "21:00" });

  // ─────────────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const activeEl = document.activeElement;
        if (activeEl?.tagName === "TEXTAREA") return;
        if (activeEl?.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "text") return;
        
        // Find and click the continue button
        const continueBtn = document.querySelector("[data-continue]") as HTMLButtonElement;
        if (continueBtn && !continueBtn.disabled) {
          e.preventDefault();
          continueBtn.click();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────

  const transition = useCallback((nextStage: Stage) => {
    setFadeIn(false);
    setTimeout(() => {
      setStage(nextStage);
      setFadeIn(true);
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 400);
  }, []);

  const getCurrentPillar = (): Pillar | null => {
    const map: Record<string, Pillar> = {
      "vision-health": "HEALTH", "vision-wealth": "WEALTH", "vision-relationships": "RELATIONSHIPS",
      "vision-career": "CAREER", "vision-spiritual": "SPIRITUAL", "vision-contribution": "CONTRIBUTION",
    };
    return map[stage] || null;
  };

  const getNextVisionStage = (): Stage => {
    const order: Stage[] = ["vision-health", "vision-wealth", "vision-relationships", 
                           "vision-career", "vision-spiritual", "vision-contribution"];
    const idx = order.indexOf(stage as Stage);
    return idx < order.length - 1 ? order[idx + 1] : "northstar-intro";
  };

  const handleVisionNext = () => {
    const pillar = getCurrentPillar();
    if (!pillar) return;
    const newVisions = currentVisionInputs.filter(v => v.trim()).map(title => ({
      pillar, title: title.trim(), horizon: "SOMEDAY" as TimeHorizon,
    }));
    setVisions([...visions, ...newVisions]);
    setCurrentVisionInputs(["", "", ""]);
    transition(getNextVisionStage());
  };

  const getVisionsForPillar = (p: Pillar) => visions.filter(v => v.pillar === p);

  // ─────────────────────────────────────────────────────────────────────────
  // Save & Complete
  // ─────────────────────────────────────────────────────────────────────────

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Save visions
      for (const vision of visions) {
        await fetch("/api/life/visions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vision),
        });
      }
      // Save North Stars
      for (const [pillar, title] of Object.entries(northStars)) {
        if (title && title !== "__custom__") {
          await fetch("/api/life/north-stars", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pillar, title, active: true }),
          });
        }
      }
      // Save Identities
      for (const [pillar, statement] of Object.entries(identities)) {
        if (statement) {
          await fetch("/api/life/identities", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pillar, statement }),
          });
        }
      }
      // Save settings
      await fetch("/api/life/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingCompleted: true, onboardingStep: 100,
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

  // ─────────────────────────────────────────────────────────────────────────
  // Progress
  // ─────────────────────────────────────────────────────────────────────────

  const getProgress = () => {
    const idx = STAGE_ORDER.indexOf(stage);
    return Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
  };

  const firstName = session?.user?.name?.split(" ")[0] || "Navigator";

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Preparing your journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#030303] text-white overflow-y-auto overflow-x-hidden">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AMBIENT BACKGROUND */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-violet-600/8 rounded-full blur-[120px] animate-drift" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-600/8 rounded-full blur-[100px] animate-drift-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-rose-600/5 rounded-full blur-[80px] animate-pulse-slow" />
        
        {/* Star field */}
        <div className="absolute inset-0 opacity-30">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                opacity: Math.random() * 0.5 + 0.2,
              }}
            />
          ))}
        </div>
        
        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PROGRESS BAR */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {stage !== "intro" && stage !== "complete" && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-white/5">
          <div 
            className="h-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-700 ease-out"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        className={`relative z-10 transition-all duration-500 ease-out ${
          fadeIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-[0.98]"
        }`}
      >
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* INTRO */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-2xl text-center">
              {/* Compass icon with glow */}
              <div className="relative inline-block mb-10">
                <div className="absolute inset-0 bg-violet-500/30 rounded-full blur-2xl scale-150 animate-pulse-slow" />
                <div className="relative text-7xl sm:text-8xl animate-float">🧭</div>
              </div>
              
              <h1 className="text-4xl sm:text-6xl font-bold mb-6 tracking-tight">
                <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                  The Navigator&apos;s
                </span>
                <br />
                <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                  Journey
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-white/50 mb-4">
                This is not a setup wizard.
              </p>
              <p className="text-lg sm:text-xl text-white/50 mb-12">
                This is a journey to design your life with intention.
              </p>
              
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full text-white/40 text-sm mb-12 border border-white/10">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>15-20 minutes · Find a quiet space</span>
              </div>
              
              <button
                data-continue
                onClick={() => transition("wake-up")}
                className="group relative px-10 sm:px-14 py-4 sm:py-5 bg-gradient-to-r from-violet-600 to-violet-500 rounded-2xl text-base sm:text-lg font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-500/25 active:scale-[0.98]"
              >
                <span className="relative z-10">Begin the Journey</span>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-violet-400 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              
              <p className="mt-8 text-white/20 text-sm">
                Press Enter ↵ to continue at any time
              </p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* WAKE-UP CALL */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "wake-up" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 rounded-full text-violet-400 text-xs uppercase tracking-widest mb-8 border border-violet-500/20">
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                Act I · The Wake-Up Call
              </div>
              
              <h2 className="text-3xl sm:text-5xl font-bold mb-10 leading-tight tracking-tight">
                Most entrepreneurs are building empires on
                <span className="text-violet-400"> shaky foundations.</span>
              </h2>
              
              <div className="space-y-6 text-base sm:text-lg text-white/60 leading-relaxed">
                <p>They crush it at work. Revenue grows. Teams expand. The business thrives.</p>
                <p className="text-white/40">But at 2 AM, staring at the ceiling, something feels off.</p>
                <p>Health declining. Relationships strained. That nagging sense that success isn&apos;t supposed to feel this... <span className="text-white/80 italic">hollow</span>.</p>
              </div>
              
              <div className="mt-12 p-6 bg-white/[0.02] rounded-2xl border border-white/5">
                <p className="text-white/80 text-lg">Sound familiar?</p>
              </div>
              
              <button
                data-continue
                onClick={() => transition("four-modes")}
                className="mt-10 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 text-white/80 hover:text-white border border-white/10 hover:border-white/20"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* FOUR MODES */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "four-modes" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-4xl w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 rounded-full text-violet-400 text-xs uppercase tracking-widest mb-8 border border-violet-500/20">
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                The Four Modes of Living
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-12">
                There are four ways to move through life:
              </h2>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { id: "drowning", emoji: "🌊", title: "Drowning", color: "red", desc: "Overwhelmed. Reactive. Every day is survival. No time to think, only to respond." },
                  { id: "drifting", emoji: "🍂", title: "Drifting", color: "amber", desc: "Comfortable but directionless. Going with the flow. Life happens TO you." },
                  { id: "surfing", emoji: "🏄", title: "Surfing", color: "blue", desc: "Riding waves. Opportunistic. Exciting, but no destination. You never choose the shore." },
                  { id: "navigating", emoji: "🧭", title: "Navigating", color: "emerald", desc: "Charting a course. Intentional. You choose the destination and move with purpose." },
                ].map((mode, idx) => (
                  <div
                    key={mode.id}
                    className={`group p-6 rounded-2xl border transition-all duration-500 hover:scale-[1.02] cursor-default`}
                    style={{
                      background: `linear-gradient(135deg, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 100%)`,
                      animationDelay: `${idx * 100}ms`,
                      ["--tw-gradient-from" as string]: mode.color === "red" ? "rgba(239,68,68,0.1)" : mode.color === "amber" ? "rgba(245,158,11,0.1)" : mode.color === "blue" ? "rgba(59,130,246,0.1)" : "rgba(16,185,129,0.1)",
                      ["--tw-gradient-to" as string]: "transparent",
                      borderColor: mode.color === "red" ? "rgba(239,68,68,0.2)" : mode.color === "amber" ? "rgba(245,158,11,0.2)" : mode.color === "blue" ? "rgba(59,130,246,0.2)" : "rgba(16,185,129,0.2)",
                    }}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <span className="text-4xl">{mode.emoji}</span>
                      <h3 className={`text-2xl font-bold ${
                        mode.color === "red" ? "text-red-400" : mode.color === "amber" ? "text-amber-400" : mode.color === "blue" ? "text-blue-400" : "text-emerald-400"
                      }`}>
                        {mode.title}
                      </h3>
                    </div>
                    <p className="text-white/50">{mode.desc}</p>
                  </div>
                ))}
              </div>
              
              <button
                data-continue
                onClick={() => transition("which-mode")}
                className="mt-10 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 text-white/80 hover:text-white border border-white/10 hover:border-white/20"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* WHICH MODE */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "which-mode" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl w-full text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full text-white/40 text-xs uppercase tracking-widest mb-8 border border-white/10">
                Honest Reflection
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Be honest with yourself.</h2>
              <p className="text-xl text-white/50 mb-12">Which mode have you been living in lately?</p>
              
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "drowning", emoji: "🌊", label: "Drowning", color: "red" },
                  { id: "drifting", emoji: "🍂", label: "Drifting", color: "amber" },
                  { id: "surfing", emoji: "🏄", label: "Surfing", color: "blue" },
                  { id: "navigating", emoji: "🧭", label: "Navigating", color: "emerald" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] ${
                      selectedMode === mode.id
                        ? mode.color === "red" ? "bg-red-500/20 border-red-500" :
                          mode.color === "amber" ? "bg-amber-500/20 border-amber-500" :
                          mode.color === "blue" ? "bg-blue-500/20 border-blue-500" :
                          "bg-emerald-500/20 border-emerald-500"
                        : "bg-white/[0.02] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="text-4xl mb-3">{mode.emoji}</div>
                    <div className={`font-medium ${
                      selectedMode === mode.id
                        ? mode.color === "red" ? "text-red-400" :
                          mode.color === "amber" ? "text-amber-400" :
                          mode.color === "blue" ? "text-blue-400" :
                          "text-emerald-400"
                        : "text-white/70"
                    }`}>
                      {mode.label}
                    </div>
                  </button>
                ))}
              </div>
              
              {selectedMode && (
                <button
                  data-continue
                  onClick={() => transition("navigator-path")}
                  className="mt-10 px-10 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.02]"
                >
                  Continue →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* NAVIGATOR'S PATH */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "navigator-path" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full text-emerald-400 text-xs uppercase tracking-widest mb-8 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                The Navigator&apos;s Path
              </div>
              
              {selectedMode !== "navigating" ? (
                <>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-8 leading-tight">
                    That&apos;s okay.
                    <span className="text-white/40"> Most of us have been there.</span>
                  </h2>
                  <div className="space-y-6 text-lg text-white/60 leading-relaxed">
                    <p>The good news? <span className="text-white">Today you make a different choice.</span></p>
                    <p>Today, you become a <span className="text-emerald-400 font-semibold">Navigator</span>.</p>
                    <p className="text-white/40">Someone who charts their own course. Who designs their life intentionally. Who knows where they&apos;re going and why.</p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-8 leading-tight">
                    Excellent.
                    <span className="text-emerald-400"> You already think like a Navigator.</span>
                  </h2>
                  <div className="space-y-6 text-lg text-white/60 leading-relaxed">
                    <p>But even the best navigators need to update their charts.</p>
                    <p><span className="text-white">What got you here won&apos;t get you there.</span></p>
                    <p className="text-white/40">Let&apos;s recalibrate your compass for the journey ahead.</p>
                  </div>
                </>
              )}
              
              <div className="mt-12 p-6 bg-white/[0.02] rounded-2xl border border-white/5">
                <p className="text-white/60 italic text-lg">
                  &ldquo;What the mind can conceive and believe, it can achieve.&rdquo;
                </p>
                <p className="text-white/30 text-sm mt-2">— Napoleon Hill</p>
              </div>
              
              <button
                data-continue
                onClick={() => transition("gratitude-intro")}
                className="mt-10 px-10 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.02]"
              >
                Let&apos;s Begin →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* GRATITUDE INTRO */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "gratitude-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-full text-amber-400 text-xs uppercase tracking-widest mb-8 border border-amber-500/20">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                Act II · Grounding
              </div>
              
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl scale-150 animate-pulse-slow" />
                <div className="relative text-7xl animate-float">🙏</div>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Before we dream forward,
                <br />
                <span className="text-amber-400">let&apos;s honor the present.</span>
              </h2>
              
              <p className="text-lg text-white/50 leading-relaxed">
                Gratitude isn&apos;t just positive thinking. It&apos;s <span className="text-white/70">grounding</span>. 
                It reminds you that you&apos;re not starting from zero.
              </p>
              
              <button
                data-continue
                onClick={() => transition("gratitude")}
                className="mt-12 px-10 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.02]"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* GRATITUDE */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "gratitude" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-full text-amber-400 text-xs uppercase tracking-widest mb-6 border border-amber-500/20">
                Gratitude
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                What are five things you&apos;re genuinely grateful for?
              </h2>
              <p className="text-white/50 mb-8">
                Not what you think you should say. What actually fills you with gratitude.
              </p>
              
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="flex items-center gap-3 group">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                      gratitude[idx].trim() 
                        ? "bg-amber-500 text-white scale-110" 
                        : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {gratitude[idx].trim() ? "✓" : idx + 1}
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
                      className="flex-1 px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                ))}
              </div>
              
              <button
                data-continue
                onClick={() => transition("pride-intro")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.01]"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PRIDE INTRO */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "pride-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl text-center">
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl scale-150 animate-pulse-slow" />
                <div className="relative text-7xl animate-float">💪</div>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Now, acknowledge
                <span className="text-orange-400"> your power.</span>
              </h2>
              
              <p className="text-lg text-white/50 leading-relaxed mb-4">
                You have accomplished things. You have overcome obstacles.
              </p>
              <p className="text-white/70">
                You have proof that you can achieve.
              </p>
              <p className="text-white/30 mt-6 text-sm">
                This isn&apos;t arrogance. It&apos;s evidence.
              </p>
              
              <button
                data-continue
                onClick={() => transition("pride")}
                className="mt-12 px-10 py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.02]"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PRIDE */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "pride" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 rounded-full text-orange-400 text-xs uppercase tracking-widest mb-6 border border-orange-500/20">
                Pride
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                What are five things you&apos;re genuinely proud of?
              </h2>
              <p className="text-white/50 mb-8">
                Accomplishments, qualities, moments when you showed up as your best self.
              </p>
              
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                      pride[idx].trim() 
                        ? "bg-orange-500 text-white scale-110" 
                        : "bg-orange-500/20 text-orange-400"
                    }`}>
                      {pride[idx].trim() ? "✓" : idx + 1}
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
                      className="flex-1 px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 focus:bg-white/[0.05] transition-all"
                    />
                  </div>
                ))}
              </div>
              
              <button
                data-continue
                onClick={() => transition("pillars-intro")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.01]"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* PILLARS INTRO */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "pillars-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 rounded-full text-violet-400 text-xs uppercase tracking-widest mb-8 border border-violet-500/20">
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                Act III · Vision
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                A life is not just a business.
              </h2>
              <p className="text-lg text-white/50 mb-12">
                True success is a balanced wheel. We&apos;ll explore six pillars of a complete life.
              </p>
              
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4 mb-12">
                {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => (
                  <div
                    key={pillar}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all hover:scale-105"
                  >
                    <div className="text-3xl sm:text-4xl mb-2">{config.emoji}</div>
                    <div className="text-xs sm:text-sm text-white/50">{config.label}</div>
                  </div>
                ))}
              </div>
              
              <p className="text-white/40 mb-2">For each pillar, you&apos;ll answer one question:</p>
              <p className="text-xl text-white font-medium mb-8">
                &ldquo;What do I <span className="text-violet-400">really</span> want?&rdquo;
              </p>
              <p className="text-white/30 text-sm italic">
                No justification needed. No &ldquo;how&rdquo; required. Just honest desire.
              </p>
              
              <button
                data-continue
                onClick={() => transition("vision-health")}
                className="mt-12 px-10 py-4 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.02]"
              >
                Begin Dreaming →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* VISION STAGES */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {["vision-health", "vision-wealth", "vision-relationships", "vision-career", "vision-spiritual", "vision-contribution"].includes(stage) && (() => {
          const pillar = getCurrentPillar()!;
          const config = PILLAR_CONFIG[pillar];
          const q = PILLAR_QUESTIONS[pillar];
          const pillarIndex = ["HEALTH", "WEALTH", "RELATIONSHIPS", "CAREER", "SPIRITUAL", "CONTRIBUTION"].indexOf(pillar);
          
          return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
              <div className="max-w-xl w-full">
                {/* Pillar indicator */}
                <div className="flex items-center gap-2 mb-8">
                  {Object.entries(PILLAR_CONFIG).map(([p, c], idx) => (
                    <div
                      key={p}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all duration-300 ${
                        idx < pillarIndex ? "bg-white/10 opacity-50" :
                        idx === pillarIndex ? "scale-125 shadow-lg" : "bg-white/5 opacity-30"
                      }`}
                      style={idx === pillarIndex ? { backgroundColor: config.color + "30" } : {}}
                    >
                      {c.emoji}
                    </div>
                  ))}
                </div>
                
                <div className="flex items-start gap-4 mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                    style={{ backgroundColor: config.color + "20" }}
                  >
                    {config.emoji}
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-widest mb-1" style={{ color: config.color }}>
                      {q.title}
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-bold">{q.question}</h2>
                  </div>
                </div>
                
                <p className="text-white/50 mb-8 leading-relaxed">{q.prompt}</p>
                
                <div className="space-y-3 mb-4">
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
                      placeholder={idx === 0 ? `e.g., ${q.examples[0]}` : "Add another..."}
                      className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none transition-all"
                      style={{ 
                        borderColor: currentVisionInputs[idx] ? config.color + "50" : undefined,
                        backgroundColor: currentVisionInputs[idx] ? "rgba(255,255,255,0.05)" : undefined,
                      }}
                    />
                  ))}
                </div>
                
                <p className="text-white/20 text-sm mb-8">
                  💡 {q.examples.join(" · ")}
                </p>
                
                <button
                  data-continue
                  onClick={handleVisionNext}
                  className={`w-full py-4 rounded-xl transition-all duration-300 font-medium hover:scale-[1.01] bg-gradient-to-r ${q.gradient}`}
                >
                  Continue →
                </button>
              </div>
            </div>
          );
        })()}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* NORTH STAR INTRO */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "northstar-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 rounded-full text-cyan-400 text-xs uppercase tracking-widest mb-8 border border-cyan-500/20">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                Act IV · Focus
              </div>
              
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-3xl scale-150 animate-pulse-slow" />
                <div className="relative text-7xl animate-float">⭐</div>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Dreams are infinite.
                <br />
                <span className="text-cyan-400">Time is not.</span>
              </h2>
              
              <p className="text-lg text-white/50 mb-6">
                From everything you envisioned, select <span className="text-white">one goal per pillar</span> for the next 12 months.
              </p>
              
              <p className="text-white/30">
                This becomes your <span className="text-cyan-400 font-medium">North Star</span> — the guiding light you&apos;ll review every morning and evening.
              </p>
              
              <button
                data-continue
                onClick={() => transition("northstar")}
                className="mt-12 px-10 py-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.02]"
              >
                Choose My North Star →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* NORTH STAR */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "northstar" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 rounded-full text-cyan-400 text-xs uppercase tracking-widest mb-6 border border-cyan-500/20">
                Your North Star
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">
                One goal per pillar. <span className="text-cyan-400">12 months.</span>
              </h2>
              <p className="text-white/50 mb-8">Make it specific and compelling.</p>
              
              <div className="space-y-3">
                {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => {
                  const pillarVisions = getVisionsForPillar(pillar as Pillar);
                  return (
                    <div key={pillar} className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{config.emoji}</span>
                        <span className="font-medium text-white/80">{config.label}</span>
                      </div>
                      {pillarVisions.length > 0 ? (
                        <select
                          value={northStars[pillar as Pillar]}
                          onChange={(e) => setNorthStars({ ...northStars, [pillar]: e.target.value })}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                        >
                          <option value="">Select your 12-month goal...</option>
                          {pillarVisions.map((v, idx) => (
                            <option key={idx} value={v.title}>{v.title}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={northStars[pillar as Pillar]}
                          onChange={(e) => setNorthStars({ ...northStars, [pillar]: e.target.value })}
                          placeholder={`My ${config.label.toLowerCase()} goal...`}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              
              <button
                data-continue
                onClick={() => transition("identity-intro")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.01]"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* IDENTITY INTRO */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "identity-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-full text-purple-400 text-xs uppercase tracking-widest mb-8 border border-purple-500/20">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                Act V · Identity
              </div>
              
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-3xl scale-150 animate-pulse-slow" />
                <div className="relative text-7xl animate-float">🦋</div>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Goals are what you want.
                <br />
                <span className="text-purple-400">Identity is who you become.</span>
              </h2>
              
              <p className="text-lg text-white/50 mb-8">
                The deepest level of change is identity change. When you shift who you <em>are</em>, behaviors follow naturally.
              </p>
              
              <div className="bg-white/[0.02] rounded-2xl p-6 border border-white/5 text-left">
                <p className="text-white/50 mb-2">Instead of:</p>
                <p className="text-white/30 mb-4">&ldquo;I want to exercise more&rdquo;</p>
                <p className="text-white/50 mb-2">Declare:</p>
                <p className="text-purple-400 font-medium text-lg">&ldquo;I am a person who takes care of my body daily&rdquo;</p>
              </div>
              
              <button
                data-continue
                onClick={() => transition("identity")}
                className="mt-12 px-10 py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.02]"
              >
                Define Who I Am →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* IDENTITY */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "identity" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-xl w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-full text-purple-400 text-xs uppercase tracking-widest mb-6 border border-purple-500/20">
                Identity Statements
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">
                Who must you <span className="text-purple-400">become</span>?
              </h2>
              <p className="text-white/50 mb-8">Complete: &ldquo;I am a person who...&rdquo;</p>
              
              <div className="space-y-3">
                {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => (
                  <div key={pillar} className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">{config.emoji}</span>
                      <span className="text-white/50 text-sm">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/30 text-sm whitespace-nowrap">I am a person who</span>
                      <input
                        type="text"
                        value={identities[pillar as Pillar]}
                        onChange={(e) => setIdentities({ ...identities, [pillar]: e.target.value })}
                        placeholder="..."
                        className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <button
                data-continue
                onClick={() => transition("ritual-intro")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.01]"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* RITUAL INTRO */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "ritual-intro" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 rounded-full text-rose-400 text-xs uppercase tracking-widest mb-8 border border-rose-500/20">
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
                Act VI · Commitment
              </div>
              
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-3xl scale-150 animate-pulse-slow" />
                <div className="relative text-7xl animate-float">🔥</div>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Knowledge without practice
                <span className="text-rose-400"> is useless.</span>
              </h2>
              
              <p className="text-lg text-white/50 mb-10">
                The magic isn&apos;t in knowing your North Star. It&apos;s in <span className="text-white">programming it</span> into your subconscious through daily repetition.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-amber-500/10 rounded-2xl p-6 border border-amber-500/20 text-left">
                  <div className="text-4xl mb-3">☀️</div>
                  <h3 className="text-xl font-bold text-amber-400 mb-2">Morning Ritual</h3>
                  <p className="text-white/50 text-sm">Gratitude, pride, North Star review. Program your intention.</p>
                </div>
                <div className="bg-indigo-500/10 rounded-2xl p-6 border border-indigo-500/20 text-left">
                  <div className="text-4xl mb-3">🌙</div>
                  <h3 className="text-xl font-bold text-indigo-400 mb-2">Evening Ritual</h3>
                  <p className="text-white/50 text-sm">Wins, reflection, goal review. Let your subconscious work overnight.</p>
                </div>
              </div>
              
              <button
                data-continue
                onClick={() => transition("ritual-setup")}
                className="px-10 py-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.02]"
              >
                Set My Ritual Times →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* RITUAL SETUP */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "ritual-setup" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-md w-full text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 rounded-full text-rose-400 text-xs uppercase tracking-widest mb-6 border border-rose-500/20">
                Daily Commitment
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-bold mb-8">When will you practice?</h2>
              
              <div className="space-y-4">
                <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">☀️</span>
                      <span className="font-medium text-lg">Morning</span>
                    </div>
                    <span className="text-white/30 text-sm">~10 min</span>
                  </div>
                  <input
                    type="time"
                    value={ritualTimes.morning}
                    onChange={(e) => setRitualTimes({ ...ritualTimes, morning: e.target.value })}
                    className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-xl text-white text-center text-2xl font-light focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                
                <div className="p-6 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🌙</span>
                      <span className="font-medium text-lg">Evening</span>
                    </div>
                    <span className="text-white/30 text-sm">~5 min</span>
                  </div>
                  <input
                    type="time"
                    value={ritualTimes.evening}
                    onChange={(e) => setRitualTimes({ ...ritualTimes, evening: e.target.value })}
                    className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-xl text-white text-center text-2xl font-light focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>
              
              <button
                data-continue
                onClick={() => transition("oath")}
                className="mt-8 w-full py-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 rounded-xl transition-all duration-300 font-medium hover:scale-[1.01]"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* OATH */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "oath" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full text-emerald-400 text-xs uppercase tracking-widest mb-8 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Act VII · Launch
              </div>
              
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl scale-150 animate-pulse-slow" />
                <div className="relative text-7xl">🧭</div>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-10">The Navigator&apos;s Oath</h2>
              
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-3xl p-8 sm:p-10 border border-emerald-500/20 text-left mb-10">
                <p className="text-xl sm:text-2xl text-white/90 leading-relaxed mb-8">
                  I, <span className="text-emerald-400 font-semibold">{firstName}</span>, choose to be a Navigator.
                </p>
                <div className="space-y-4 text-white/60">
                  <p>I will not <span className="text-red-400/80">drift</span> through life waiting for direction.</p>
                  <p>I will not <span className="text-red-400/80">drown</span> in busyness without purpose.</p>
                  <p>I will not merely <span className="text-blue-400/80">surf</span> from opportunity to opportunity.</p>
                </div>
                <p className="text-white/90 leading-relaxed mt-8 font-medium">
                  I will chart my course. I will review it daily. I will become the person my North Star requires.
                </p>
              </div>
              
              <button
                data-continue
                onClick={handleComplete}
                disabled={saving}
                className="group relative px-12 py-5 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-2xl text-lg font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-500/20 disabled:opacity-50 disabled:hover:scale-100"
              >
                <span className="relative z-10">{saving ? "Launching..." : "I Am a Navigator ✨"}</span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* COMPLETE */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {stage === "complete" && (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
            <div className="max-w-2xl text-center">
              {/* Celebration burst */}
              <div className="relative inline-block mb-10">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 via-cyan-500/30 to-emerald-500/30 rounded-full blur-3xl scale-150 animate-pulse" />
                <div className="relative text-8xl sm:text-9xl animate-bounce">🎉</div>
              </div>
              
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  Welcome, Navigator.
                </span>
              </h2>
              
              <p className="text-xl text-white/50 mb-12">
                Your journey has begun. Your North Star is set. Your identity is declared.
              </p>
              
              <div className="bg-white/[0.02] rounded-2xl p-8 border border-white/5 text-left mb-10">
                <h3 className="text-lg font-semibold mb-6 text-white/80">Your Daily Practice:</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-white/60">
                    <span className="text-2xl">☀️</span>
                    <span>Morning ritual at <span className="text-amber-400 font-medium">{ritualTimes.morning}</span></span>
                  </div>
                  <div className="flex items-center gap-4 text-white/60">
                    <span className="text-2xl">🌙</span>
                    <span>Evening ritual at <span className="text-indigo-400 font-medium">{ritualTimes.evening}</span></span>
                  </div>
                  <div className="flex items-center gap-4 text-white/60">
                    <span className="text-2xl">📝</span>
                    <span>Weekly review every <span className="text-violet-400 font-medium">Sunday</span></span>
                  </div>
                </div>
              </div>
              
              <p className="text-2xl text-white/60 italic mb-12">
                &ldquo;Dream. Believe. Achieve.&rdquo;
              </p>
              
              <button
                onClick={() => router.push("/life")}
                className="group relative px-12 py-5 bg-gradient-to-r from-violet-600 to-violet-500 rounded-2xl text-lg font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-500/20"
              >
                <span className="relative z-10">Enter the Life System →</span>
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-violet-400 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STYLES */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -20px); }
        }
        @keyframes drift-slow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, 30px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-drift { animation: drift 20s ease-in-out infinite; }
        .animate-drift-slow { animation: drift-slow 25s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-twinkle { animation: twinkle 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
