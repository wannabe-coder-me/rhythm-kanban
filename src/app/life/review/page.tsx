"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { WeeklyReview, PILLAR_CONFIG } from "@/types";
import { startOfWeek, format, subWeeks, addWeeks } from "date-fns";

export default function WeeklyReviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [currentStep, setCurrentStep] = useState<"wins" | "insights" | "adjustments" | "focus" | "scores" | "complete">("wins");

  // Form state
  const [form, setForm] = useState({
    wins: "",
    insights: "",
    adjustments: "",
    nextFocus: "",
  });

  // Life score state
  const [scores, setScores] = useState({
    healthScore: 5,
    wealthScore: 5,
    relationScore: 5,
    careerScore: 5,
    spiritualScore: 5,
    contributionScore: 5,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchReview();
    }
  }, [session, selectedWeek]);

  const fetchReview = async () => {
    try {
      const weekStr = format(selectedWeek, "yyyy-MM-dd");
      const res = await fetch(`/api/life/reviews?week=${weekStr}`);

      if (res.ok) {
        const data = await res.json();
        setReview(data);
        if (data) {
          setForm({
            wins: data.wins ?? "",
            insights: data.insights ?? "",
            adjustments: data.adjustments ?? "",
            nextFocus: data.nextFocus ?? "",
          });
          if (data.completedAt) {
            setCurrentStep("complete");
          }
        } else {
          setForm({ wins: "", insights: "", adjustments: "", nextFocus: "" });
          setCurrentStep("wins");
        }
      }
    } catch (error) {
      console.error("Failed to fetch review:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStep = async () => {
    try {
      await fetch("/api/life/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: format(selectedWeek, "yyyy-MM-dd"),
          ...form,
        }),
      });
    } catch (error) {
      console.error("Failed to save review:", error);
    }
  };

  const handleNext = async () => {
    await handleSaveStep();

    if (currentStep === "wins") setCurrentStep("insights");
    else if (currentStep === "insights") setCurrentStep("adjustments");
    else if (currentStep === "adjustments") setCurrentStep("focus");
    else if (currentStep === "focus") setCurrentStep("scores");
    else if (currentStep === "scores") await handleComplete();
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Save review as complete
      await fetch("/api/life/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: format(selectedWeek, "yyyy-MM-dd"),
          ...form,
          completedAt: new Date().toISOString(),
        }),
      });

      // Save life scores
      await fetch("/api/life/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: format(selectedWeek, "yyyy-MM-dd"),
          ...scores,
        }),
      });

      setCurrentStep("complete");
    } catch (error) {
      console.error("Failed to complete review:", error);
    } finally {
      setSaving(false);
    }
  };

  const isCurrentWeek = format(selectedWeek, "yyyy-MM-dd") === format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a12] via-[#1a1a2e] to-[#0a0a12]">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/life" className="text-white/60 hover:text-white">
              ← Back
            </Link>
            <span className="text-xl font-semibold text-white">📝 Weekly Review</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Week Selector */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
            className="p-2 text-white/60 hover:text-white"
          >
            ←
          </button>
          <div className="text-center">
            <div className="text-lg text-white font-medium">
              Week of {format(selectedWeek, "MMM d, yyyy")}
            </div>
            {isCurrentWeek && (
              <div className="text-sm text-violet-400">Current Week</div>
            )}
          </div>
          <button
            onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
            disabled={isCurrentWeek}
            className="p-2 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            →
          </button>
        </div>

        {/* Progress Steps */}
        {currentStep !== "complete" && (
          <div className="flex justify-center gap-2 mb-8">
            {["wins", "insights", "adjustments", "focus", "scores"].map((step, idx) => (
              <div
                key={step}
                className={`w-3 h-3 rounded-full transition-colors ${
                  ["wins", "insights", "adjustments", "focus", "scores"].indexOf(currentStep) >= idx
                    ? "bg-violet-500"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step: Wins */}
        {currentStep === "wins" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-2">Celebrate Your Wins</h2>
              <p className="text-white/60">What went well this week?</p>
            </div>

            <textarea
              value={form.wins}
              onChange={(e) => setForm({ ...form, wins: e.target.value })}
              placeholder="List your wins, big and small..."
              rows={6}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-violet-400 resize-none"
            />

            <button
              onClick={handleNext}
              className="w-full mt-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-xl transition-all"
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step: Insights */}
        {currentStep === "insights" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">💡</div>
              <h2 className="text-2xl font-bold text-white mb-2">Capture Insights</h2>
              <p className="text-white/60">What did you learn this week?</p>
            </div>

            <textarea
              value={form.insights}
              onChange={(e) => setForm({ ...form, insights: e.target.value })}
              placeholder="Key learnings, realizations, aha moments..."
              rows={6}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-violet-400 resize-none"
            />

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setCurrentStep("wins")}
                className="px-6 py-4 bg-white/5 text-white/60 rounded-xl hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Adjustments */}
        {currentStep === "adjustments" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🔄</div>
              <h2 className="text-2xl font-bold text-white mb-2">Course Corrections</h2>
              <p className="text-white/60">What needs to change?</p>
            </div>

            <textarea
              value={form.adjustments}
              onChange={(e) => setForm({ ...form, adjustments: e.target.value })}
              placeholder="Adjustments, things to stop/start/continue..."
              rows={6}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-violet-400 resize-none"
            />

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setCurrentStep("insights")}
                className="px-6 py-4 bg-white/5 text-white/60 rounded-xl hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Focus */}
        {currentStep === "focus" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold text-white mb-2">Next Week&apos;s Focus</h2>
              <p className="text-white/60">Top priorities for next week</p>
            </div>

            <textarea
              value={form.nextFocus}
              onChange={(e) => setForm({ ...form, nextFocus: e.target.value })}
              placeholder="1. Priority one&#10;2. Priority two&#10;3. Priority three"
              rows={6}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-violet-400 resize-none"
            />

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setCurrentStep("adjustments")}
                className="px-6 py-4 bg-white/5 text-white/60 rounded-xl hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-4 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-semibold rounded-xl transition-all"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step: Life Scores */}
        {currentStep === "scores" && (
          <div className="animate-fadeIn">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-2xl font-bold text-white mb-2">Rate Your Week</h2>
              <p className="text-white/60">Score each pillar 1-10</p>
            </div>

            <div className="space-y-4 bg-white/5 rounded-xl p-6 border border-white/10">
              {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => {
                const key = `${pillar.toLowerCase()}Score` as keyof typeof scores;
                // Map special cases
                const scoreKey = pillar === "RELATIONSHIPS" ? "relationScore" : key;
                const actualKey = scoreKey as keyof typeof scores;
                
                return (
                  <div key={pillar}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>{config.emoji}</span>
                        <span className="text-white">{config.label}</span>
                      </div>
                      <span className="font-bold" style={{ color: config.color }}>
                        {scores[actualKey]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={scores[actualKey]}
                      onChange={(e) => setScores({
                        ...scores,
                        [actualKey]: parseInt(e.target.value),
                      })}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setCurrentStep("focus")}
                className="px-6 py-4 bg-white/5 text-white/60 rounded-xl hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={saving}
                className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {saving ? "Saving..." : "Complete Review ✓"}
              </button>
            </div>
          </div>
        )}

        {/* Complete */}
        {currentStep === "complete" && (
          <div className="animate-fadeIn text-center">
            <div className="text-8xl mb-6">✨</div>
            <h2 className="text-3xl font-bold text-white mb-4">Review Complete!</h2>
            <p className="text-white/60 mb-8">
              Great reflection. You&apos;re ready for next week.
            </p>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10 text-left mb-8">
              {form.wins && (
                <div className="mb-4">
                  <h3 className="text-sm text-white/40 mb-2">🎉 Wins</h3>
                  <p className="text-white/80 whitespace-pre-wrap">{form.wins}</p>
                </div>
              )}
              {form.insights && (
                <div className="mb-4">
                  <h3 className="text-sm text-white/40 mb-2">💡 Insights</h3>
                  <p className="text-white/80 whitespace-pre-wrap">{form.insights}</p>
                </div>
              )}
              {form.adjustments && (
                <div className="mb-4">
                  <h3 className="text-sm text-white/40 mb-2">🔄 Adjustments</h3>
                  <p className="text-white/80 whitespace-pre-wrap">{form.adjustments}</p>
                </div>
              )}
              {form.nextFocus && (
                <div>
                  <h3 className="text-sm text-white/40 mb-2">🎯 Next Week&apos;s Focus</h3>
                  <p className="text-white/80 whitespace-pre-wrap">{form.nextFocus}</p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep("wins")}
                className="flex-1 py-3 bg-white/5 text-white/60 rounded-xl hover:bg-white/10"
              >
                Edit Review
              </button>
              <Link
                href="/life"
                className="flex-1 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-center"
              >
                Back to Dashboard
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
