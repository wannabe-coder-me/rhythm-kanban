"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Board, BoardMember, User, BoardVisibility, BoardInvite } from "@/types";

interface BoardSettingsProps {
  board: Board;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onBoardUpdate: (board: Board) => void;
  onBoardDelete: () => void;
}

type Tab = "general" | "members" | "danger";

interface MemberWithOwner extends BoardMember {
  isOwner?: boolean;
}

export function BoardSettings({
  board,
  currentUserId,
  isOpen,
  onClose,
  onBoardUpdate,
  onBoardDelete,
}: BoardSettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // General tab state
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || "");
  const [visibility, setVisibility] = useState<BoardVisibility>(board.visibility);

  // Members tab state
  const [members, setMembers] = useState<MemberWithOwner[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [pendingInvites, setPendingInvites] = useState<BoardInvite[]>([]);

  // Danger zone state
  const [newOwnerId, setNewOwnerId] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Determine current user's role
  const isOwner = board.ownerId === currentUserId;
  const currentMember = board.members?.find((m) => m.userId === currentUserId);
  const isAdmin = currentMember?.role === "admin";
  const canEdit = isOwner || isAdmin;

  // Fetch members
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [board.id]);

  // Fetch pending invites
  const fetchPendingInvites = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${board.id}/invites`);
      if (res.ok) {
        const data = await res.json();
        setPendingInvites(data);
      }
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    }
  }, [board.id]);

  // Revoke invite
  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch(
        `/api/boards/${board.id}/invites?inviteId=${inviteId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setPendingInvites(pendingInvites.filter((i) => i.id !== inviteId));
        setSuccess("Invite revoked!");
      }
    } catch (err) {
      setError("Failed to revoke invite");
    }
  };

  // Format expiry date
  const formatExpiry = (date: Date) => {
    const expiry = new Date(date);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expired";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  useEffect(() => {
    if (isOpen && activeTab === "members") {
      fetchMembers();
      if (canEdit) {
        fetchPendingInvites();
      }
    }
  }, [isOpen, activeTab, fetchMembers, fetchPendingInvites, canEdit]);

  // Reset state when board changes
  useEffect(() => {
    setName(board.name);
    setDescription(board.description || "");
    setVisibility(board.visibility);
  }, [board]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Save general settings
  const handleSaveGeneral = async () => {
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, visibility }),
      });
      if (res.ok) {
        const updated = await res.json();
        onBoardUpdate(updated);
        setSuccess("Settings saved successfully!");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  // Invite member
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail("");
        setShowInviteForm(false);
        setSuccess("Member added successfully!");
        fetchMembers();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to add member");
      }
    } catch (err) {
      setError("Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  // Update member role
  const handleUpdateRole = async (userId: string, role: string) => {
    clearMessages();
    try {
      const res = await fetch(`/api/boards/${board.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        fetchMembers();
        setSuccess("Role updated!");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update role");
      }
    } catch (err) {
      setError("Failed to update role");
    }
  };

  // Remove member
  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this board?`)) return;
    clearMessages();
    try {
      const res = await fetch(`/api/boards/${board.id}/members/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchMembers();
        setSuccess("Member removed!");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to remove member");
      }
    } catch (err) {
      setError("Failed to remove member");
    }
  };

  // Transfer ownership
  const handleTransferOwnership = async () => {
    if (!newOwnerId) return;
    const newOwner = members.find((m) => m.userId === newOwnerId);
    if (!confirm(`Transfer ownership to ${newOwner?.user?.name || newOwner?.user?.email}? This action cannot be undone.`)) {
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId }),
      });
      if (res.ok) {
        const updated = await res.json();
        onBoardUpdate(updated);
        setSuccess("Ownership transferred!");
        setNewOwnerId("");
        fetchMembers();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to transfer ownership");
      }
    } catch (err) {
      setError("Failed to transfer ownership");
    } finally {
      setLoading(false);
    }
  };

  // Delete board
  const handleDeleteBoard = async () => {
    if (deleteConfirmation !== board.name) {
      setError("Please type the board name exactly to confirm deletion");
      return;
    }
    if (!confirm("This will permanently delete the board and all its data. Continue?")) {
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onBoardDelete();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete board");
      }
    } catch (err) {
      setError("Failed to delete board");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Board Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {[
            { id: "general", label: "General" },
            { id: "members", label: "Members" },
            { id: "danger", label: "Danger Zone", show: isOwner },
          ]
            .filter((tab) => tab.show !== false)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as Tab);
                  clearMessages();
                }}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-white border-b-2 border-indigo-500"
                    : "text-slate-400 hover:text-white"
                } ${tab.id === "danger" ? "text-red-400 hover:text-red-300" : ""}`}
              >
                {tab.label}
              </button>
            ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-sm">
              {success}
            </div>
          )}

          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Board Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canEdit}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as BoardVisibility)}
                  disabled={!canEdit}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="private">🔒 Private - Only members can access</option>
                  <option value="team">👥 Team - All signed-in users can view</option>
                  <option value="public">🌍 Public - Anyone can view</option>
                </select>
              </div>

              {canEdit && (
                <button
                  onClick={handleSaveGeneral}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <div className="space-y-4">
              {/* Header with count and invite button */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">
                  Members ({members.length})
                </h3>
                {canEdit && (
                  <button
                    onClick={() => setShowInviteForm(!showInviteForm)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Member
                  </button>
                )}
              </div>

              {/* Invite form */}
              {showInviteForm && (
                <form onSubmit={handleInvite} className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email address"
                      required
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "admin" | "member" | "viewer")}
                      className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                    >
                      {loading ? "Adding..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInviteForm(false);
                        setInviteEmail("");
                      }}
                      className="text-slate-400 hover:text-white px-3 py-1.5 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Members list */}
              {loadingMembers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        {member.user?.image ? (
                          <Image
                            src={member.user.image}
                            alt={member.user.name || "User"}
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-slate-300">
                            {(member.user?.name || member.user?.email || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="text-white font-medium flex items-center gap-2">
                            {member.user?.name || "Unknown"}
                            {member.isOwner && (
                              <span className="text-yellow-500" title="Board Owner">
                                👑
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-sm">
                            {member.user?.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {member.isOwner ? (
                          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm font-medium">
                            Owner
                          </span>
                        ) : canEdit ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                            className="bg-slate-600 border border-slate-500 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="px-3 py-1 bg-slate-600 text-slate-300 rounded text-sm capitalize">
                            {member.role}
                          </span>
                        )}

                        {canEdit && !member.isOwner && (
                          <button
                            onClick={() => handleRemoveMember(member.userId, member.user?.name || member.user?.email || "this member")}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                            title="Remove member"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === "danger" && isOwner && (
            <div className="space-y-6">
              {/* Transfer Ownership */}
              <div className="border border-orange-500/30 rounded-lg p-4">
                <h3 className="text-lg font-medium text-orange-400 mb-2">
                  Transfer Ownership
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  Transfer this board to another member. You will become an admin.
                </p>
                <div className="flex gap-3">
                  <select
                    value={newOwnerId}
                    onChange={(e) => setNewOwnerId(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select new owner...</option>
                    {members
                      .filter((m) => !m.isOwner)
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user?.name || m.user?.email}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleTransferOwnership}
                    disabled={!newOwnerId || loading}
                    className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-colors"
                  >
                    Transfer
                  </button>
                </div>
              </div>

              {/* Delete Board */}
              <div className="border border-red-500/30 rounded-lg p-4">
                <h3 className="text-lg font-medium text-red-400 mb-2">
                  Delete Board
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  Permanently delete this board and all its data. This action cannot be undone.
                </p>
                <p className="text-slate-300 text-sm mb-3">
                  Type <span className="font-mono bg-slate-700 px-2 py-0.5 rounded">{board.name}</span> to confirm:
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type board name..."
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    onClick={handleDeleteBoard}
                    disabled={deleteConfirmation !== board.name || loading}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-colors"
                  >
                    {loading ? "Deleting..." : "Delete Board"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
