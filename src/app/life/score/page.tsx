"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LifeScore, Pillar, PILLAR_CONFIG } from "@/types";
import { startOfWeek, format, subWeeks, addWeeks } from "date-fns";

export default function LifeScorePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentScore, setCurrentScore] = useState<LifeScore | null>(null);
  const [history, setHistory] = useState<LifeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));

  // Form state
  const [scores, setScores] = useState({
    healthScore: 5,
    wealthScore: 5,
    relationScore: 5,
    careerScore: 5,
    spiritualScore: 5,
    contributionScore: 5,
    notes: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchScores();
    }
  }, [session, selectedWeek]);

  const fetchScores = async () => {
    try {
      const weekStr = format(selectedWeek, "yyyy-MM-dd");
      const [scoreRes, historyRes] = await Promise.all([
        fetch(`/api/life/scores?week=${weekStr}`),
        fetch("/api/life/scores/history"),
      ]);

      if (scoreRes.ok) {
        const data = await scoreRes.json();
        setCurrentScore(data);
        if (data) {
          setScores({
            healthScore: data.healthScore ?? 5,
            wealthScore: data.wealthScore ?? 5,
            relationScore: data.relationScore ?? 5,
            careerScore: data.careerScore ?? 5,
            spiritualScore: data.spiritualScore ?? 5,
            contributionScore: data.contributionScore ?? 5,
            notes: data.notes ?? "",
          });
        }
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch scores:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/life/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: format(selectedWeek, "yyyy-MM-dd"),
          ...scores,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentScore(data);
        setEditing(false);
        fetchScores(); // Refresh history
      }
    } catch (error) {
      console.error("Failed to save scores:", error);
    } finally {
      setSaving(false);
    }
  };

  const getOverallScore = () => {
    const values = [
      scores.healthScore,
      scores.wealthScore,
      scores.relationScore,
      scores.careerScore,
      scores.spiritualScore,
      scores.contributionScore,
    ];
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const scoreFields: { key: keyof typeof scores; pillar: Pillar }[] = [
    { key: "healthScore", pillar: "HEALTH" },
    { key: "wealthScore", pillar: "WEALTH" },
    { key: "relationScore", pillar: "RELATIONSHIPS" },
    { key: "careerScore", pillar: "CAREER" },
    { key: "spiritualScore", pillar: "SPIRITUAL" },
    { key: "contributionScore", pillar: "CONTRIBUTION" },
  ];

  const isCurrentWeek = format(selectedWeek, "yyyy-MM-dd") === format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");

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
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/life" className="text-white/60 hover:text-white">
              ← Back
            </Link>
            <span className="text-xl font-semibold text-white">📈 Life Score</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-white/50 italic mb-8">
          &ldquo;Navigate with awareness&rdquo; — Rate each pillar 1-10 weekly.
        </p>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Balance Wheel */}
          <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-6 text-center">
              Life Balance Wheel
            </h2>
            
            <div className="relative w-64 h-64 mx-auto">
              {/* Wheel visualization */}
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Background circles */}
                {[2, 4, 6, 8, 10].map((level) => (
                  <circle
                    key={level}
                    cx="100"
                    cy="100"
                    r={level * 8}
                    fill="none"
                    stroke="white"
                    strokeOpacity="0.1"
                    strokeWidth="1"
                  />
                ))}

                {/* Score polygon */}
                <polygon
                  points={scoreFields.map((field, idx) => {
                    const angle = (idx * 60 - 90) * (Math.PI / 180);
                    const score = typeof scores[field.key] === "number" ? scores[field.key] as number : 5;
                    const r = score * 8;
                    const x = 100 + r * Math.cos(angle);
                    const y = 100 + r * Math.sin(angle);
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="url(#scoreGradient)"
                  fillOpacity="0.3"
                  stroke="url(#scoreGradient)"
                  strokeWidth="2"
                />

                {/* Gradient */}
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>

                {/* Labels */}
                {scoreFields.map((field, idx) => {
                  const config = PILLAR_CONFIG[field.pillar];
                  const angle = (idx * 60 - 90) * (Math.PI / 180);
                  const x = 100 + 95 * Math.cos(angle);
                  const y = 100 + 95 * Math.sin(angle);
                  return (
                    <text
                      key={field.key}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-2xl"
                    >
                      {config.emoji}
                    </text>
                  );
                })}

                {/* Center score */}
                <text
                  x="100"
                  y="95"
                  textAnchor="middle"
                  fill="white"
                  className="text-3xl font-bold"
                  fontSize="24"
                >
                  {getOverallScore()}
                </text>
                <text
                  x="100"
                  y="115"
                  textAnchor="middle"
                  fill="white"
                  fillOpacity="0.5"
                  fontSize="10"
                >
                  Overall
                </text>
              </svg>
            </div>

            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="w-full mt-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
              >
                {currentScore ? "Update Scores" : "Rate This Week"}
              </button>
            )}
          </div>

          {/* Score Inputs or Display */}
          <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-6">
              {editing ? "Rate Each Pillar (1-10)" : "Pillar Scores"}
            </h2>

            <div className="space-y-4">
              {scoreFields.map((field) => {
                const config = PILLAR_CONFIG[field.pillar];
                const score = typeof scores[field.key] === "number" ? scores[field.key] as number : 5;
                
                return (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>{config.emoji}</span>
                        <span className="text-white">{config.label}</span>
                      </div>
                      <span 
                        className="font-bold"
                        style={{ color: config.color }}
                      >
                        {score}
                      </span>
                    </div>
                    {editing ? (
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={score}
                        onChange={(e) => setScores({
                          ...scores,
                          [field.key]: parseInt(e.target.value),
                        })}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
                      />
                    ) : (
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${score * 10}%`,
                            backgroundColor: config.color,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {editing && (
              <>
                <div className="mt-6">
                  <label className="block text-sm text-white/60 mb-2">Notes (optional)</label>
                  <textarea
                    value={scores.notes}
                    onChange={(e) => setScores({ ...scores, notes: e.target.value })}
                    placeholder="Any reflections on this week..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-400 resize-none"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setEditing(false);
                      if (currentScore) {
                        setScores({
                          healthScore: currentScore.healthScore ?? 5,
                          wealthScore: currentScore.wealthScore ?? 5,
                          relationScore: currentScore.relationScore ?? 5,
                          careerScore: currentScore.careerScore ?? 5,
                          spiritualScore: currentScore.spiritualScore ?? 5,
                          contributionScore: currentScore.contributionScore ?? 5,
                          notes: currentScore.notes ?? "",
                        });
                      }
                    }}
                    className="flex-1 py-3 bg-white/5 text-white/60 rounded-lg hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Scores"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Trend History */}
        {history.length > 0 && (
          <div className="mt-8 bg-[#1a1a2e] rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-6">Trend (Last 12 Weeks)</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 border-b border-white/10">
                    <th className="text-left py-3 px-2">Week</th>
                    {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => (
                      <th key={pillar} className="text-center py-3 px-2">
                        <span title={config.label}>{config.emoji}</span>
                      </th>
                    ))}
                    <th className="text-center py-3 px-2">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 12).map((score) => (
                    <tr key={score.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-2 text-white/60">
                        {format(new Date(score.weekStart), "MMM d")}
                      </td>
                      <td className="text-center py-3 px-2 text-green-400">{score.healthScore ?? "-"}</td>
                      <td className="text-center py-3 px-2 text-amber-400">{score.wealthScore ?? "-"}</td>
                      <td className="text-center py-3 px-2 text-rose-400">{score.relationScore ?? "-"}</td>
                      <td className="text-center py-3 px-2 text-blue-400">{score.careerScore ?? "-"}</td>
                      <td className="text-center py-3 px-2 text-purple-400">{score.spiritualScore ?? "-"}</td>
                      <td className="text-center py-3 px-2 text-teal-400">{score.contributionScore ?? "-"}</td>
                      <td className="text-center py-3 px-2 text-white font-medium">{score.overallScore ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
