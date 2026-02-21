"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Vision, Pillar, TimeHorizon, PILLAR_CONFIG, HORIZON_CONFIG } from "@/types";

export default function VisionBoardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [visions, setVisions] = useState<Vision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPillar, setSelectedPillar] = useState<Pillar | "ALL">("ALL");
  const [selectedHorizon, setSelectedHorizon] = useState<TimeHorizon | "ALL">("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVision, setEditingVision] = useState<Vision | null>(null);

  // Form state
  const [formPillar, setFormPillar] = useState<Pillar>("HEALTH");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formHorizon, setFormHorizon] = useState<TimeHorizon>("SOMEDAY");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchVisions();
    }
  }, [session]);

  const fetchVisions = async () => {
    try {
      const res = await fetch("/api/life/visions");
      if (res.ok) {
        const data = await res.json();
        setVisions(data);
      }
    } catch (error) {
      console.error("Failed to fetch visions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVision = async () => {
    if (!formTitle.trim()) return;

    try {
      const res = await fetch("/api/life/visions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pillar: formPillar,
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          horizon: formHorizon,
        }),
      });

      if (res.ok) {
        const newVision = await res.json();
        setVisions([...visions, newVision]);
        resetForm();
        setShowAddModal(false);
      }
    } catch (error) {
      console.error("Failed to add vision:", error);
    }
  };

  const handleUpdateVision = async () => {
    if (!editingVision || !formTitle.trim()) return;

    try {
      const res = await fetch(`/api/life/visions/${editingVision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          horizon: formHorizon,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setVisions(visions.map((v) => (v.id === updated.id ? updated : v)));
        resetForm();
        setEditingVision(null);
      }
    } catch (error) {
      console.error("Failed to update vision:", error);
    }
  };

  const handleDeleteVision = async (id: string) => {
    if (!confirm("Delete this vision?")) return;

    try {
      const res = await fetch(`/api/life/visions/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setVisions(visions.filter((v) => v.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete vision:", error);
    }
  };

  const openEditModal = (vision: Vision) => {
    setEditingVision(vision);
    setFormPillar(vision.pillar);
    setFormTitle(vision.title);
    setFormDescription(vision.description || "");
    setFormHorizon(vision.horizon);
  };

  const resetForm = () => {
    setFormPillar("HEALTH");
    setFormTitle("");
    setFormDescription("");
    setFormHorizon("SOMEDAY");
  };

  const filteredVisions = visions.filter((v) => {
    if (selectedPillar !== "ALL" && v.pillar !== selectedPillar) return false;
    if (selectedHorizon !== "ALL" && v.horizon !== selectedHorizon) return false;
    return true;
  });

  const groupedByPillar = filteredVisions.reduce((acc, v) => {
    if (!acc[v.pillar]) acc[v.pillar] = [];
    acc[v.pillar].push(v);
    return acc;
  }, {} as Record<Pillar, Vision[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] overflow-y-auto">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/life" className="text-white/60 hover:text-white">
              ← Back
            </Link>
            <span className="text-xl font-semibold text-white">👁️ Vision Board</span>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2"
          >
            <span>+</span> Add Vision
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Subtitle */}
        <p className="text-white/50 italic mb-6">
          &ldquo;No justification needed. I want it because I want it.&rdquo;
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
          {/* Pillar filter */}
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Pillar:</span>
            <div className="flex bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setSelectedPillar("ALL")}
                className={`px-3 py-1 rounded text-sm ${
                  selectedPillar === "ALL"
                    ? "bg-violet-600 text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                All
              </button>
              {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => (
                <button
                  key={pillar}
                  onClick={() => setSelectedPillar(pillar as Pillar)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedPillar === pillar
                      ? "bg-violet-600 text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {config.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Horizon filter */}
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Horizon:</span>
            <div className="flex bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setSelectedHorizon("ALL")}
                className={`px-3 py-1 rounded text-sm ${
                  selectedHorizon === "ALL"
                    ? "bg-violet-600 text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                All
              </button>
              {Object.entries(HORIZON_CONFIG).map(([horizon, config]) => (
                <button
                  key={horizon}
                  onClick={() => setSelectedHorizon(horizon as TimeHorizon)}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedHorizon === horizon
                      ? "bg-violet-600 text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vision Cards by Pillar */}
        {Object.entries(PILLAR_CONFIG).map(([pillar, config]) => {
          const pillarVisions = groupedByPillar[pillar as Pillar] || [];
          if (selectedPillar !== "ALL" && selectedPillar !== pillar) return null;
          
          return (
            <div key={pillar} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ backgroundColor: config.color + "20" }}
                >
                  {config.emoji}
                </div>
                <h2 className="text-xl font-semibold text-white">
                  {config.label}
                </h2>
                <span className="text-white/40 text-sm">
                  What do I really want?
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pillarVisions.map((vision) => (
                  <div
                    key={vision.id}
                    className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10 hover:border-white/20 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          backgroundColor: config.color + "20",
                          color: config.color,
                        }}
                      >
                        {HORIZON_CONFIG[vision.horizon].label}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={() => openEditModal(vision)}
                          className="p-1 text-white/40 hover:text-white"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteVision(vision.id)}
                          className="p-1 text-white/40 hover:text-red-400"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      {vision.title}
                    </h3>
                    {vision.description && (
                      <p className="text-white/60 text-sm">{vision.description}</p>
                    )}
                  </div>
                ))}

                {/* Add Vision Card */}
                <button
                  onClick={() => {
                    resetForm();
                    setFormPillar(pillar as Pillar);
                    setShowAddModal(true);
                  }}
                  className="bg-white/5 rounded-xl p-4 border border-dashed border-white/20 hover:border-violet-400/50 hover:bg-violet-600/5 transition-colors flex flex-col items-center justify-center min-h-[120px] text-white/40 hover:text-violet-400"
                >
                  <span className="text-2xl mb-2">+</span>
                  <span className="text-sm">Add Vision</span>
                </button>
              </div>
            </div>
          );
        })}
      </main>

      {/* Add/Edit Modal */}
      {(showAddModal || editingVision) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setEditingVision(null);
            resetForm();
          }}
        >
          <div
            className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-md border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white mb-4">
              {editingVision ? "Edit Vision" : "Add Vision"}
            </h2>

            <div className="space-y-4">
              {/* Pillar Select (only for new) */}
              {!editingVision && (
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
              )}

              {/* Title */}
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  What do you want?
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Villa by the beach"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-400"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Details (optional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe your vision..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-400 resize-none"
                />
              </div>

              {/* Horizon */}
              <div>
                <label className="block text-sm text-white/60 mb-2">
                  Time Horizon
                </label>
                <div className="flex gap-2">
                  {Object.entries(HORIZON_CONFIG).map(([horizon, config]) => (
                    <button
                      key={horizon}
                      type="button"
                      onClick={() => setFormHorizon(horizon as TimeHorizon)}
                      className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                        formHorizon === horizon
                          ? "bg-violet-600 text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingVision(null);
                  resetForm();
                }}
                className="flex-1 py-3 rounded-lg bg-white/5 text-white/60 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={editingVision ? handleUpdateVision : handleAddVision}
                disabled={!formTitle.trim()}
                className="flex-1 py-3 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingVision ? "Save Changes" : "Add Vision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
