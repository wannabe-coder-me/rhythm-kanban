"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NorthStar, PILLAR_CONFIG, RitualEntry } from "@/types";

const EVENING_QUOTES = [
  { quote: "Rest when you're weary. Refresh and renew yourself, your body, your mind, your spirit.", author: "Ralph Marston" },
  { quote: "Finish each day and be done with it. Tomorrow is a new day.", author: "Ralph Waldo Emerson" },
  { quote: "The day is ending, but your dreams are just beginning.", author: "Unknown" },
  { quote: "Stars can't shine without darkness. Your challenges today prepared you for tomorrow.", author: "Unknown" },
  { quote: "As you end this day, remember: you are exactly where you need to be.", author: "Unknown" },
];

type Step = "wins" | "northstar" | "reflection" | "complete";

export default function EveningRitualPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("wins");
  const [ritual, setRitual] = useState<Partial<RitualEntry>>({});
  const [northStars, setNorthStars] = useState<NorthStar[]>([]);
  const [quote] = useState(() => 
    EVENING_QUOTES[Math.floor(Math.random() * EVENING_QUOTES.length)]
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const [ritualRes, northStarRes] = await Promise.all([
        fetch("/api/life/rituals?type=evening"),
        fetch("/api/life/north-stars"),
      ]);
      
      if (ritualRes.ok) {
        const rituals = await ritualRes.json();
        if (rituals.length > 0) {
          setRitual(rituals[0]);
          if (rituals[0].completedAt) {
            setCurrentStep("complete");
          }
        }
      }
      
      if (northStarRes.ok) {
        const data = await northStarRes.json();
        setNorthStars(data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async (updates: Partial<RitualEntry>, completed = false) => {
    setSaving(true);
    try {
      const res = await fetch("/api/life/rituals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "evening",
          ...ritual,
          ...updates,
          completed,
        }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setRitual(updated);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === "wins") {
      await saveProgress({ wins: ritual.wins });
      setCurrentStep("northstar");
    } else if (currentStep === "northstar") {
      await saveProgress({ northStarReviewed: true });
      setCurrentStep("reflection");
    } else if (currentStep === "reflection") {
      await saveProgress({ reflection: ritual.reflection }, true);
      setCurrentStep("complete");
    }
  };

  const updateField = (field: keyof RitualEntry, value: string) => {
    setRitual({ ...ritual, [field]: value });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900/30 via-[#0a0a12] to-purple-900/30 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900/30 via-[#0a0a12] to-purple-900/30">
      {/* Stars background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
              opacity: 0.3 + Math.random() * 0.5,
            }}
          />
        ))}
        {/* Moon */}
        <div className="absolute top-20 right-20 w-24 h-24 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 opacity-20 shadow-[0_0_60px_30px_rgba(255,255,255,0.1)]" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/life" className="text-white/60 hover:text-white flex items-center gap-2">
            ← Exit
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-3xl">🌙</span>
            <span className="text-xl font-semibold text-white">Evening Ritual</span>
          </div>
          <div className="text-white/40 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="relative max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          {["wins", "northstar", "reflection", "complete"].map((step, idx) => (
            <div
              key={step}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                currentStep === step
                  ? "bg-indigo-500 text-white scale-110"
                  : ["wins", "northstar", "reflection", "complete"].indexOf(currentStep) > idx
                  ? "bg-indigo-500/50 text-white"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {idx + 1}
            </div>
          ))}
        </div>
        <div className="h-1 bg-white/10 rounded-full">
          <div
            className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-500"
            style={{
              width: `${
                (["wins", "northstar", "reflection", "complete"].indexOf(currentStep) / 3) * 100
              }%`,
            }}
          />
        </div>
      </div>

      <main className="relative max-w-3xl mx-auto px-6 py-8">
        {/* Inspirational Quote */}
        <div className="text-center mb-8 p-6 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-xl text-white/90 italic mb-2">&ldquo;{quote.quote}&rdquo;</p>
          <p className="text-indigo-400">— {quote.author}</p>
        </div>

        {/* Step: Wins */}
        {currentStep === "wins" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-2xl font-bold text-white mb-2">Celebrate Your Wins</h2>
              <p className="text-white/60">
                What went well today? Big or small, acknowledge your victories.
              </p>
            </div>

            <textarea
              value={ritual.wins || ""}
              onChange={(e) => updateField("wins", e.target.value)}
              placeholder="Today I... 

• Completed my morning ritual
• Made progress on my project  
• Had a great conversation with...
• Stayed focused during...
• Took care of my health by..."
              rows={10}
              className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all resize-none"
            />

            <div className="mt-4 p-4 bg-indigo-500/10 rounded-xl border border-indigo-400/20">
              <p className="text-indigo-300 text-sm">
                💡 <strong>Remember:</strong> Small wins compound into massive achievements. 
                Every step forward matters.
              </p>
            </div>

            <button
              onClick={handleNext}
              disabled={saving}
              className="w-full mt-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue to North Star →"}
            </button>
          </div>
        )}

        {/* Step: North Star Review */}
        {currentStep === "northstar" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">⭐</div>
              <h2 className="text-2xl font-bold text-white mb-2">Evening Star Gaze</h2>
              <p className="text-white/60">
                Review your North Star one more time. Let it sink into your subconscious as you sleep.
              </p>
            </div>

            <div className="bg-gradient-to-br from-violet-900/30 to-purple-900/30 rounded-2xl p-6 border border-violet-400/20 mb-6">
              <h3 className="text-center text-lg font-semibold text-violet-300 mb-6">
                MY NORTH STAR {new Date().getFullYear()}
              </h3>
              
              <div className="space-y-4">
                {northStars.length > 0 ? (
                  northStars.map((ns) => (
                    <div key={ns.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: PILLAR_CONFIG[ns.pillar].color + "20" }}
                      >
                        {PILLAR_CONFIG[ns.pillar].emoji}
                      </div>
                      <div className="flex-1">
                        <div className="text-white/50 text-xs uppercase">
                          {PILLAR_CONFIG[ns.pillar].label}
                        </div>
                        <div className="text-white font-medium">{ns.title}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{ color: PILLAR_CONFIG[ns.pillar].color }}>
                          {ns.progress}%
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-white/40">
                    <p>No goals set yet</p>
                  </div>
                )}
              </div>
              
              <div className="mt-6 p-4 bg-white/5 rounded-xl text-center">
                <p className="text-white/60 text-sm italic">
                  🌙 &ldquo;Your subconscious works while you sleep. 
                  Plant these goals deep as you drift off.&rdquo;
                </p>
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={saving}
              className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "I have reviewed with emotion ✓"}
            </button>
          </div>
        )}

        {/* Step: Reflection */}
        {currentStep === "reflection" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🔮</div>
              <h2 className="text-2xl font-bold text-white mb-2">Reflect & Plan</h2>
              <p className="text-white/60">
                Any insights from today? What will you focus on tomorrow?
              </p>
            </div>

            <textarea
              value={ritual.reflection || ""}
              onChange={(e) => updateField("reflection", e.target.value)}
              placeholder="Reflections:
• What did I learn today?
• What could I have done better?
• What am I excited about for tomorrow?

Tomorrow's top priorities:
1. 
2. 
3. "
              rows={10}
              className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-white/10 transition-all resize-none"
            />

            <button
              onClick={handleNext}
              disabled={saving}
              className="w-full mt-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? "Completing..." : "Complete Evening Ritual ✓"}
            </button>
          </div>
        )}

        {/* Step: Complete */}
        {currentStep === "complete" && (
          <div className="animate-fadeIn text-center">
            <div className="mb-8">
              <div className="text-8xl mb-4">😴</div>
              <h2 className="text-3xl font-bold text-white mb-2">Rest Well, Navigator</h2>
              <p className="text-white/60 text-lg">
                Your mind is programmed. Your goals are planted. Sweet dreams.
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl p-8 border border-indigo-400/20 mb-8">
              <div className="text-5xl mb-4">✨</div>
              <p className="text-xl text-white/90 italic mb-4">
                &ldquo;While you sleep, your subconscious works on your dreams.&rdquo;
              </p>
              <p className="text-indigo-400">
                See you tomorrow morning! ☀️
              </p>
            </div>

            <Link
              href="/life"
              className="inline-block px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all"
            >
              Return to Dashboard
            </Link>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
