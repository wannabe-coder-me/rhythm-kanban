"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NorthStar, PILLAR_CONFIG, RitualEntry } from "@/types";

const INSPIRATIONAL_QUOTES = [
  { quote: "What the mind can conceive and believe, it can achieve.", author: "Napoleon Hill" },
  { quote: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
  { quote: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { quote: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "The mind is everything. What you think you become.", author: "Buddha" },
];

type Step = "gratitude" | "pride" | "northstar" | "identity" | "complete";

export default function MorningRitualPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("gratitude");
  const [ritual, setRitual] = useState<Partial<RitualEntry>>({});
  const [northStars, setNorthStars] = useState<NorthStar[]>([]);
  const [quote] = useState(() => 
    INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)]
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
        fetch("/api/life/rituals?type=morning"),
        fetch("/api/life/north-stars"),
      ]);
      
      if (ritualRes.ok) {
        const rituals = await ritualRes.json();
        if (rituals.length > 0) {
          setRitual(rituals[0]);
          // If already completed, show complete screen
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
          type: "morning",
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
    if (currentStep === "gratitude") {
      await saveProgress({
        gratitude1: ritual.gratitude1,
        gratitude2: ritual.gratitude2,
        gratitude3: ritual.gratitude3,
        gratitude4: ritual.gratitude4,
        gratitude5: ritual.gratitude5,
      });
      setCurrentStep("pride");
    } else if (currentStep === "pride") {
      await saveProgress({
        proud1: ritual.proud1,
        proud2: ritual.proud2,
        proud3: ritual.proud3,
        proud4: ritual.proud4,
        proud5: ritual.proud5,
      });
      setCurrentStep("northstar");
    } else if (currentStep === "northstar") {
      await saveProgress({ northStarReviewed: true });
      setCurrentStep("identity");
    } else if (currentStep === "identity") {
      await saveProgress({ identity: ritual.identity }, true);
      setCurrentStep("complete");
    }
  };

  const updateField = (field: keyof RitualEntry, value: string) => {
    setRitual({ ...ritual, [field]: value });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900/20 via-[#0a0a12] to-orange-900/20 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900/20 via-[#0a0a12] to-orange-900/20">
      {/* Animated sun rays background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] opacity-10">
          <div className="absolute inset-0 bg-gradient-radial from-amber-400 to-transparent animate-pulse" 
               style={{ animationDuration: '4s' }} />
        </div>
      </div>

      {/* Header */}
      <header className="relative border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/life" className="text-white/60 hover:text-white flex items-center gap-2">
            ← Exit
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-3xl">☀️</span>
            <span className="text-xl font-semibold text-white">Morning Ritual</span>
          </div>
          <div className="text-white/40 text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="relative max-w-3xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          {["gratitude", "pride", "northstar", "identity", "complete"].map((step, idx) => (
            <div
              key={step}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                currentStep === step
                  ? "bg-amber-500 text-white scale-110"
                  : ["gratitude", "pride", "northstar", "identity", "complete"].indexOf(currentStep) > idx
                  ? "bg-amber-500/50 text-white"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {idx + 1}
            </div>
          ))}
        </div>
        <div className="h-1 bg-white/10 rounded-full">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
            style={{
              width: `${
                (["gratitude", "pride", "northstar", "identity", "complete"].indexOf(currentStep) / 4) * 100
              }%`,
            }}
          />
        </div>
      </div>

      <main className="relative max-w-3xl mx-auto px-6 py-8">
        {/* Inspirational Quote */}
        <div className="text-center mb-8 p-6 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-xl text-white/90 italic mb-2">&ldquo;{quote.quote}&rdquo;</p>
          <p className="text-amber-400">— {quote.author}</p>
        </div>

        {/* Step: Gratitude */}
        {currentStep === "gratitude" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🙏</div>
              <h2 className="text-2xl font-bold text-white mb-2">Start with Gratitude</h2>
              <p className="text-white/60">
                What are 5 things you&apos;re grateful for today?
              </p>
            </div>

            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-semibold">
                    {num}
                  </div>
                  <input
                    type="text"
                    value={ritual[`gratitude${num}` as keyof RitualEntry] as string || ""}
                    onChange={(e) => updateField(`gratitude${num}` as keyof RitualEntry, e.target.value)}
                    placeholder="I am grateful for..."
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 focus:bg-white/10 transition-all"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={saving}
              className="w-full mt-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue to Pride →"}
            </button>
          </div>
        )}

        {/* Step: Pride */}
        {currentStep === "pride" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">💪</div>
              <h2 className="text-2xl font-bold text-white mb-2">Celebrate Your Wins</h2>
              <p className="text-white/60">
                What are 5 things you&apos;re personally proud of?
              </p>
            </div>

            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-semibold">
                    {num}
                  </div>
                  <input
                    type="text"
                    value={ritual[`proud${num}` as keyof RitualEntry] as string || ""}
                    onChange={(e) => updateField(`proud${num}` as keyof RitualEntry, e.target.value)}
                    placeholder="I am proud that..."
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-green-400/50 focus:bg-white/10 transition-all"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={saving}
              className="w-full mt-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
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
              <h2 className="text-2xl font-bold text-white mb-2">Review Your North Star</h2>
              <p className="text-white/60">
                Read each goal with EMOTION. Feel it as if already achieved.
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
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-white/40">
                    <p className="mb-4">No North Star goals set yet</p>
                    <Link href="/life/north-star" className="text-violet-400 hover:text-violet-300">
                      Set your goals →
                    </Link>
                  </div>
                )}
              </div>
              
              {northStars.length > 0 && (
                <div className="mt-6 p-4 bg-white/5 rounded-xl text-center">
                  <p className="text-white/60 text-sm italic">
                    💡 &ldquo;The mind cannot tell imagination from reality. 
                    Visualize achieving each goal with deep emotion.&rdquo;
                  </p>
                </div>
              )}
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

        {/* Step: Identity */}
        {currentStep === "identity" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🦋</div>
              <h2 className="text-2xl font-bold text-white mb-2">Who Must You Become?</h2>
              <p className="text-white/60">
                Today, I am a person who...
              </p>
            </div>

            <textarea
              value={ritual.identity || ""}
              onChange={(e) => updateField("identity", e.target.value)}
              placeholder="Today, I am a person who takes action toward my goals, treats my body as a temple, creates value for others, and shows up fully for the people I love..."
              rows={6}
              className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-blue-400/50 focus:bg-white/10 transition-all resize-none text-lg"
            />

            <div className="mt-4 p-4 bg-blue-500/10 rounded-xl border border-blue-400/20">
              <p className="text-blue-300 text-sm">
                💡 <strong>Pro tip:</strong> Write in present tense. &ldquo;I am&rdquo; not &ldquo;I will be&rdquo;. 
                Your subconscious doesn&apos;t understand future tense.
              </p>
            </div>

            <button
              onClick={handleNext}
              disabled={saving}
              className="w-full mt-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? "Completing..." : "Complete Morning Ritual ✓"}
            </button>
          </div>
        )}

        {/* Step: Complete */}
        {currentStep === "complete" && (
          <div className="animate-fadeIn text-center">
            <div className="mb-8">
              <div className="text-8xl mb-4 animate-bounce">🌟</div>
              <h2 className="text-3xl font-bold text-white mb-2">Ritual Complete!</h2>
              <p className="text-white/60 text-lg">
                You&apos;ve programmed your mind for success today.
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl p-8 border border-amber-400/20 mb-8">
              <div className="text-6xl mb-4">🔥</div>
              <p className="text-2xl font-bold text-amber-400 mb-2">
                You&apos;re on fire!
              </p>
              <p className="text-white/60">
                Consistency compounds. Come back tomorrow morning.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/life"
                className="py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/life/north-star"
                className="py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all"
              >
                View North Star
              </Link>
            </div>
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
