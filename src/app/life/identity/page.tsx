"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Pillar, PILLAR_CONFIG } from "@/types";

interface IdentityWithHabits {
  id: string;
  userId: string;
  pillar: Pillar;
  statement: string;
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  habits: {
    id: string;
    identityId: string;
    title: string;
    frequency: string;
    active: boolean;
    streak?: number;
    completedToday?: boolean;
  }[];
  proofs: { id: string; content: string; date: string }[];
}

export default function IdentityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [identities, setIdentities] = useState<IdentityWithHabits[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState<IdentityWithHabits | null>(null);
  const [showAddHabitModal, setShowAddHabitModal] = useState<string | null>(null);
  const [showAddProofModal, setShowAddProofModal] = useState<string | null>(null);

  // Form state
  const [formPillar, setFormPillar] = useState<Pillar>("HEALTH");
  const [formStatement, setFormStatement] = useState("");
  const [formHabitTitle, setFormHabitTitle] = useState("");
  const [formProofContent, setFormProofContent] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchIdentities();
    }
  }, [session]);

  const fetchIdentities = async () => {
    try {
      const res = await fetch("/api/life/identities");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data);
      }
    } catch (error) {
      console.error("Failed to fetch identities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIdentity = async () => {
    if (!formStatement.trim()) return;

    try {
      const res = await fetch("/api/life/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar: formPillar,
          statement: formStatement.trim(),
        }),
      });

      if (res.ok) {
        await fetchIdentities();
        resetForm();
        setShowAddModal(false);
      }
    } catch (error) {
      console.error("Failed to add identity:", error);
    }
  };

  const handleAddHabit = async () => {
    if (!formHabitTitle.trim() || !showAddHabitModal) return;

    try {
      const res = await fetch("/api/life/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId: showAddHabitModal,
          title: formHabitTitle.trim(),
        }),
      });

      if (res.ok) {
        await fetchIdentities();
        setFormHabitTitle("");
        setShowAddHabitModal(null);
      }
    } catch (error) {
      console.error("Failed to add habit:", error);
    }
  };

  const handleToggleHabit = async (habitId: string, completed: boolean) => {
    try {
      await fetch(`/api/life/habits/${habitId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });
      await fetchIdentities();
    } catch (error) {
      console.error("Failed to toggle habit:", error);
    }
  };

  const handleAddProof = async () => {
    if (!formProofContent.trim() || !showAddProofModal) return;

    try {
      const res = await fetch("/api/life/proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId: showAddProofModal,
          content: formProofContent.trim(),
        }),
      });

      if (res.ok) {
        await fetchIdentities();
        setFormProofContent("");
        setShowAddProofModal(null);
      }
    } catch (error) {
      console.error("Failed to add proof:", error);
    }
  };

  const handleDeleteIdentity = async (id: string) => {
    if (!confirm("Delete this identity and all its habits?")) return;

    try {
      await fetch(`/api/life/identities/${id}`, { method: "DELETE" });
      await fetchIdentities();
    } catch (error) {
      console.error("Failed to delete identity:", error);
    }
  };

  const resetForm = () => {
    setFormPillar("HEALTH");
    setFormStatement("");
  };

  const groupedByPillar = identities.reduce((acc, identity) => {
    if (!acc[identity.pillar]) acc[identity.pillar] = [];
    acc[identity.pillar].push(identity);
    return acc;
  }, {} as Record<Pillar, IdentityWithHabits[]>);

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
            <span className="text-xl font-semibold text-white">🆔 Identity & Habits</span>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2"
          >
            <span>+</span> Add Identity
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-white/50 italic mb-8">
          &ldquo;Who must I become?&rdquo; — Your habits flow from your identity.
        </p>

        {identities.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🌱</div>
            <h3 className="text-xl text-white mb-2">No identities yet</h3>
            <p className="text-white/60 mb-6">
              Start by defining who you want to become.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
            >
              Create Your First Identity
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => {
              const pillarIdentities = groupedByPillar[pillar as Pillar] || [];
              if (pillarIdentities.length === 0) return null;

              return (
                <div key={pillar}>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: config.color + "20" }}
                    >
                      {config.emoji}
                    </div>
                    <h2 className="text-xl font-semibold text-white">{config.label}</h2>
                  </div>

                  <div className="space-y-4">
                    {pillarIdentities.map((identity) => (
                      <div
                        key={identity.id}
                        className="bg-[#1a1a2e] rounded-xl border border-white/10 overflow-hidden"
                      >
                        {/* Identity Header */}
                        <div className="p-4 border-b border-white/5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-lg text-white font-medium">
                                &ldquo;{identity.statement}&rdquo;
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteIdentity(identity.id)}
                              className="text-white/30 hover:text-red-400 p-1"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Habits */}
                        <div className="p-4 border-b border-white/5">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-white/60">Habits</span>
                            <button
                              onClick={() => setShowAddHabitModal(identity.id)}
                              className="text-xs text-violet-400 hover:text-violet-300"
                            >
                              + Add Habit
                            </button>
                          </div>
                          {identity.habits.length === 0 ? (
                            <p className="text-white/40 text-sm">No habits yet</p>
                          ) : (
                            <div className="space-y-2">
                              {identity.habits.map((habit) => (
                                <div
                                  key={habit.id}
                                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => handleToggleHabit(habit.id, habit.completedToday || false)}
                                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        habit.completedToday
                                          ? "bg-green-500 border-green-500 text-white"
                                          : "border-white/30 hover:border-green-400"
                                      }`}
                                    >
                                      {habit.completedToday && "✓"}
                                    </button>
                                    <span className="text-white">{habit.title}</span>
                                  </div>
                                  {(habit.streak || 0) > 0 && (
                                    <span className="text-amber-400 text-sm flex items-center gap-1">
                                      🔥 {habit.streak}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Proofs */}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-white/60">
                              Proof (evidence I am this person)
                            </span>
                            <button
                              onClick={() => setShowAddProofModal(identity.id)}
                              className="text-xs text-violet-400 hover:text-violet-300"
                            >
                              + Add Proof
                            </button>
                          </div>
                          {identity.proofs.length === 0 ? (
                            <p className="text-white/40 text-sm">
                              No proof yet — log evidence as you live this identity
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {identity.proofs.slice(0, 3).map((proof) => (
                                <div key={proof.id} className="flex items-start gap-2 text-sm">
                                  <span className="text-green-400">•</span>
                                  <span className="text-white/70">{proof.content}</span>
                                  <span className="text-white/30 text-xs">
                                    {new Date(proof.date).toLocaleDateString()}
                                  </span>
                                </div>
                              ))}
                              {identity.proofs.length > 3 && (
                                <p className="text-white/40 text-xs">
                                  +{identity.proofs.length - 3} more
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Identity Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white mb-4">Add Identity</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Pillar</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => (
                    <button
                      key={pillar}
                      type="button"
                      onClick={() => setFormPillar(pillar as Pillar)}
                      className={`p-3 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                        formPillar === pillar
                          ? "bg-violet-600 text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xl">{config.emoji}</span>
                      <span className="text-xs">{config.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">
                  I am a person who...
                </label>
                <input
                  type="text"
                  value={formStatement}
                  onChange={(e) => setFormStatement(e.target.value)}
                  placeholder="e.g., takes care of my body daily"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleAddIdentity}
                disabled={!formStatement.trim()}
                className="flex-1 py-3 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Add Identity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Habit Modal */}
      {showAddHabitModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddHabitModal(null)}
        >
          <div
            className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white mb-4">Add Habit</h2>

            <input
              type="text"
              value={formHabitTitle}
              onChange={(e) => setFormHabitTitle(e.target.value)}
              placeholder="e.g., Morning workout"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
            />

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddHabitModal(null)}
                className="flex-1 py-3 rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleAddHabit}
                disabled={!formHabitTitle.trim()}
                className="flex-1 py-3 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Add Habit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Proof Modal */}
      {showAddProofModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddProofModal(null)}
        >
          <div
            className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white mb-4">Add Proof</h2>
            <p className="text-white/60 text-sm mb-4">
              What evidence do you have that you&apos;re living this identity?
            </p>

            <textarea
              value={formProofContent}
              onChange={(e) => setFormProofContent(e.target.value)}
              placeholder="e.g., Ran my first 5K today!"
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-400 resize-none"
            />

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddProofModal(null)}
                className="flex-1 py-3 rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProof}
                disabled={!formProofContent.trim()}
                className="flex-1 py-3 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Add Proof
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
