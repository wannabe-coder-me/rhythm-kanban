"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Board } from "@/types";
import { NotificationBell } from "@/components/NotificationBell";
import { BoardTemplateSelector } from "@/components/BoardTemplateSelector";
import { BoardTemplate, boardTemplates } from "@/lib/board-templates";

interface TaskSummary {
  total: number;
  incomplete: number;
  overdue: number;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate | null>(null);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [boardMenuOpen, setBoardMenuOpen] = useState<string | null>(null);
  const [deletingBoard, setDeletingBoard] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Board | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchBoards();
      fetchTaskSummary();
    }
  }, [session]);

  const fetchTaskSummary = async () => {
    try {
      const res = await fetch("/api/my-tasks?status=incomplete");
      if (res.ok) {
        const data = await res.json();
        setTaskSummary(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch task summary:", error);
    }
  };

  const fetchBoards = async () => {
    try {
      const res = await fetch("/api/boards");
      if (res.ok) {
        const data = await res.json();
        setBoards(data);
      }
    } catch (error) {
      console.error("Failed to fetch boards:", error);
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async () => {
    if (!newBoardName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBoardName,
          description: newBoardDesc || null,
          templateId: selectedTemplate?.id,
        }),
      });
      if (res.ok) {
        const board = await res.json();
        setBoards([...boards, board]);
        closeCreateModal();
        router.push(`/boards/${board.id}`);
      } else {
        const error = await res.json();
        console.error("Failed to create board:", res.status, error);
        alert(`Failed to create board: ${error.error || res.statusText}`);
      }
    } catch (error) {
      console.error("Failed to create board:", error);
      alert("Failed to create board. Check console for details.");
    } finally {
      setCreating(false);
    }
  };

  const deleteBoard = async (board: Board) => {
    setDeletingBoard(board.id);
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBoards(boards.filter(b => b.id !== board.id));
        setConfirmDelete(null);
      } else {
        const error = await res.json();
        alert(`Failed to delete board: ${error.error || res.statusText}`);
      }
    } catch (error) {
      console.error("Failed to delete board:", error);
      alert("Failed to delete board. Check console for details.");
    } finally {
      setDeletingBoard(null);
    }
  };

  const openCreateModal = () => {
    setCreateStep("template");
    setSelectedTemplate(boardTemplates[0]); // Default to Blank
    setNewBoardName("");
    setNewBoardDesc("");
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateStep("template");
    setSelectedTemplate(null);
    setNewBoardName("");
    setNewBoardDesc("");
  };

  const handleTemplateSelect = (template: BoardTemplate) => {
    setSelectedTemplate(template);
  };

  const proceedToDetails = () => {
    if (selectedTemplate) {
      setCreateStep("details");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Rhythm Kanban</h1>
          <div className="flex items-center gap-4">
            {/* Dashboard Link */}
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            {/* My Tasks Link */}
            <Link
              href="/my-tasks"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="text-sm font-medium">My Tasks</span>
              {taskSummary && taskSummary.incomplete > 0 && (
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${
                  taskSummary.overdue > 0 
                    ? "bg-red-500 text-white" 
                    : "bg-indigo-500 text-white"
                }`}>
                  {taskSummary.incomplete}
                </span>
              )}
            </Link>
            <NotificationBell />
            {session.user?.role === "admin" && (
              <button
                onClick={() => router.push("/admin")}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                Admin
              </button>
            )}
            <span className="text-slate-400 text-sm">{session.user?.name}</span>
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt={session.user.name || "User"}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <button
              onClick={() => signOut()}
              className="text-slate-400 hover:text-white text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-white">Your Boards</h2>
          <button
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Board
          </button>
        </div>

        {boards.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-2">No boards yet</h3>
            <p className="text-slate-500 mb-4">Create your first board to get started</p>
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Create Board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <div
                key={board.id}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg p-5 transition-all hover:border-indigo-500/50 group relative"
              >
                {/* Board Menu */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBoardMenuOpen(boardMenuOpen === board.id ? null : board.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="6" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="18" r="2" />
                    </svg>
                  </button>
                  {boardMenuOpen === board.id && (
                    <div className="absolute right-0 top-8 bg-slate-700 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[140px] z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBoardMenuOpen(null);
                          setConfirmDelete(board);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-600 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Board
                      </button>
                    </div>
                  )}
                </div>

                <div
                  onClick={() => router.push(`/boards/${board.id}`)}
                  className="cursor-pointer"
                >
                  <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors pr-8">
                    {board.name}
                  </h3>
                  {board.description && (
                    <p className="text-slate-400 text-sm mt-1 line-clamp-2">{board.description}</p>
                  )}
                  <p className="text-slate-500 text-xs mt-3">
                    Created {new Date(board.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Board Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl fade-in max-h-[90vh] overflow-y-auto">
            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`flex items-center gap-2 ${createStep === "template" ? "text-indigo-400" : "text-slate-400"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${createStep === "template" ? "bg-indigo-500 text-white" : "bg-slate-600 text-slate-300"}`}>1</span>
                <span className="text-sm font-medium">Choose Template</span>
              </div>
              <div className="flex-1 h-px bg-slate-600 mx-2" />
              <div className={`flex items-center gap-2 ${createStep === "details" ? "text-indigo-400" : "text-slate-400"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${createStep === "details" ? "bg-indigo-500 text-white" : "bg-slate-600 text-slate-300"}`}>2</span>
                <span className="text-sm font-medium">Board Details</span>
              </div>
            </div>

            {createStep === "template" ? (
              <>
                <h3 className="text-xl font-semibold text-white mb-2">Choose a Template</h3>
                <p className="text-slate-400 text-sm mb-4">Start with a pre-configured board or create a blank one</p>
                
                <BoardTemplateSelector
                  selectedId={selectedTemplate?.id ?? null}
                  onSelect={handleTemplateSelect}
                />

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={closeCreateModal}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={proceedToDetails}
                    disabled={!selectedTemplate}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    Continue
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setCreateStep("template")}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h3 className="text-xl font-semibold text-white">Board Details</h3>
                </div>

                {/* Selected Template Preview */}
                {selectedTemplate && (
                  <div className="bg-slate-700/50 rounded-lg p-3 mb-4 flex items-center gap-3">
                    <div className="flex gap-0.5">
                      {selectedTemplate.columns.slice(0, 5).map((col, i) => (
                        <div
                          key={i}
                          className="w-3 h-8 rounded-sm"
                          style={{ backgroundColor: col.color }}
                        />
                      ))}
                    </div>
                    <div>
                      <span className="text-white font-medium text-sm">{selectedTemplate.name}</span>
                      <span className="text-slate-400 text-sm ml-2">
                        ({selectedTemplate.columns.length} columns
                        {selectedTemplate.labels.length > 0 && `, ${selectedTemplate.labels.length} labels`})
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Board Name
                    </label>
                    <input
                      type="text"
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      placeholder="My Project"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={newBoardDesc}
                      onChange={(e) => setNewBoardDesc(e.target.value)}
                      placeholder="What is this board for?"
                      rows={3}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={closeCreateModal}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createBoard}
                    disabled={!newBoardName.trim() || creating}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    {creating ? "Creating..." : "Create Board"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Board</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete <span className="font-semibold text-white">&quot;{confirmDelete.name}&quot;</span>? 
              All tasks, columns, and comments will be permanently removed.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                disabled={deletingBoard === confirmDelete.id}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBoard(confirmDelete)}
                disabled={deletingBoard === confirmDelete.id}
                className="bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {deletingBoard === confirmDelete.id ? "Deleting..." : "Delete Board"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Mon Feb 16 13:24:52 CST 2026
