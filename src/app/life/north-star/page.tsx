"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NorthStar, Pillar, PILLAR_CONFIG } from "@/types";

export default function NorthStarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [northStars, setNorthStars] = useState<NorthStar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPillar, setEditingPillar] = useState<Pillar | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchNorthStars();
    }
  }, [session]);

  const fetchNorthStars = async () => {
    try {
      const res = await fetch("/api/life/north-stars");
      if (res.ok) {
        const data = await res.json();
        setNorthStars(data);
      }
    } catch (error) {
      console.error("Failed to fetch north stars:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNorthStar = async () => {
    if (!editingPillar || !formTitle.trim()) return;

    try {
      const res = await fetch("/api/life/north-stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar: editingPillar,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
        }),
      });

      if (res.ok) {
        await fetchNorthStars();
        closeModal();
      }
    } catch (error) {
      console.error("Failed to save north star:", error);
    }
  };

  const handleUpdateProgress = async (id: string, progress: number) => {
    try {
      await fetch(`/api/life/north-stars/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress }),
      });
      setNorthStars(
        northStars.map((ns) => (ns.id === id ? { ...ns, progress } : ns))
      );
    } catch (error) {
      console.error("Failed to update progress:", error);
    }
  };

  const openEditModal = (pillar: Pillar) => {
    const existing = northStars.find((ns) => ns.pillar === pillar);
    setEditingPillar(pillar);
    setFormTitle(existing?.title || "");
    setFormDescription(existing?.description || "");
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowEditModal(false);
    setEditingPillar(null);
    setFormTitle("");
    setFormDescription("");
  };

  const getNorthStarForPillar = (pillar: Pillar) => {
    return northStars.find((ns) => ns.pillar === pillar);
  };

  if (loading) {
    return (
      <div className="h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a12] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/life" className="text-white/60 hover:text-white">
              ← Back
            </Link>
            <span className="text-xl font-semibold text-white">⭐ North Star</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
        {/* The Card */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-8 border border-white/10 mb-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">
              MY NORTH STAR {new Date().getFullYear()}
            </h1>
            <p className="text-white/50 italic">
              &ldquo;Read with EMOTION every morning and evening&rdquo;
            </p>
          </div>

          <div className="space-y-4">
            {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => {
              const ns = getNorthStarForPillar(pillar as Pillar);
              return (
                <div
                  key={pillar}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer group"
                  onClick={() => openEditModal(pillar as Pillar)}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: config.color + "20" }}
                  >
                    {config.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="text-white/60 text-sm">{config.label}</div>
                    {ns ? (
                      <div className="text-white font-medium">{ns.title}</div>
                    ) : (
                      <div className="text-white/40 italic">
                        Click to set your {config.label.toLowerCase()} goal...
                      </div>
                    )}
                  </div>
                  {ns && (
                    <div className="text-right">
                      <div
                        className="text-lg font-bold"
                        style={{ color: config.color }}
                      >
                        {ns.progress}%
                      </div>
                    </div>
                  )}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white/40">✏️</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-white/40 text-sm">
              💡 &ldquo;Feel it as if already achieved. The mind cannot tell imagination from reality.&rdquo;
            </p>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-[#1a1a2e] rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">
            Update Progress
          </h2>
          <div className="space-y-4">
            {northStars.map((ns) => (
              <div key={ns.id} className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{
                    backgroundColor: PILLAR_CONFIG[ns.pillar].color + "20",
                  }}
                >
                  {PILLAR_CONFIG[ns.pillar].emoji}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium text-sm mb-1">
                    {ns.title}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ns.progress}
                    onChange={(e) =>
                      handleUpdateProgress(ns.id, parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                    style={{
                      accentColor: PILLAR_CONFIG[ns.pillar].color,
                    }}
                  />
                </div>
                <div
                  className="text-lg font-bold w-12 text-right"
                  style={{ color: PILLAR_CONFIG[ns.pillar].color }}
                >
                  {ns.progress}%
                </div>
              </div>
            ))}
            {northStars.length === 0 && (
              <p className="text-white/40 text-center py-4">
                Set your North Star goals above to track progress
              </p>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 text-center text-white/40 text-sm">
          <p className="mb-2">📋 Print this card and carry it with you</p>
          <p>👀 Review every morning and evening with emotion</p>
        </div>
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && editingPillar && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{
                  backgroundColor: PILLAR_CONFIG[editingPillar].color + "20",
                }}
              >
                {PILLAR_CONFIG[editingPillar].emoji}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {PILLAR_CONFIG[editingPillar].label} Goal
                </h2>
                <p className="text-white/50 text-sm">
                  What will you achieve in 12 months?
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  My {PILLAR_CONFIG[editingPillar].label.toLowerCase()} goal is...
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={`e.g., ${
                    editingPillar === "HEALTH"
                      ? "34-inch waist by December"
                      : editingPillar === "WEALTH"
                      ? "$500K in savings"
                      : editingPillar === "RELATIONSHIPS"
                      ? "Weekly date nights with spouse"
                      : editingPillar === "CAREER"
                      ? "Launch my SaaS product"
                      : editingPillar === "SPIRITUAL"
                      ? "Meditate 365 days"
                      : "Mentor 5 first-time founders"
                  }`}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Why this matters (optional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What will achieving this mean to you?"
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-3 rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNorthStar}
                disabled={!formTitle.trim()}
                className="flex-1 py-3 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
