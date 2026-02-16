"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { Board, BoardMember, User, BoardVisibility, BoardInvite, Column } from "@/types";
import { CustomFieldManager } from "./CustomFieldManager";

interface BoardSettingsProps {
  board: Board;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onBoardUpdate: (board: Board) => void;
  onBoardDelete: () => void;
}

type Tab = "general" | "members" | "custom-fields" | "integrations" | "danger";

interface BoardEmailAddress {
  id: string;
  boardId: string;
  email: string;
  columnId: string | null;
  isActive: boolean;
  autoAssign: boolean;
  requireMember: boolean;
  createdAt: string;
}

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

  // Email-to-task state
  const [emailSettings, setEmailSettings] = useState<BoardEmailAddress | null>(null);
  const [emailColumns, setEmailColumns] = useState<Column[]>([]);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

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

  // Fetch email settings
  const fetchEmailSettings = useCallback(async () => {
    setLoadingEmail(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/email`);
      if (res.ok) {
        const data = await res.json();
        setEmailSettings(data.emailAddress);
        setEmailColumns(data.columns || []);
      }
    } catch (err) {
      console.error("Failed to fetch email settings:", err);
    } finally {
      setLoadingEmail(false);
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
    if (isOpen && activeTab === "integrations") {
      fetchEmailSettings();
    }
  }, [isOpen, activeTab, fetchMembers, fetchPendingInvites, fetchEmailSettings, canEdit]);

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

  // Enable email-to-task
  const handleEnableEmail = async () => {
    clearMessages();
    setLoadingEmail(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: emailColumns[0]?.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setEmailSettings(data);
        setSuccess("Email-to-task enabled!");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to enable email-to-task");
      }
    } catch (err) {
      setError("Failed to enable email-to-task");
    } finally {
      setLoadingEmail(false);
    }
  };

  // Update email settings
  const handleUpdateEmailSettings = async (updates: Partial<BoardEmailAddress>) => {
    clearMessages();
    try {
      const res = await fetch(`/api/boards/${board.id}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setEmailSettings(data);
        setSuccess("Settings updated!");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update settings");
      }
    } catch (err) {
      setError("Failed to update settings");
    }
  };

  // Disable email-to-task
  const handleDisableEmail = async () => {
    if (!confirm("Disable email-to-task? The email address will be removed.")) return;
    clearMessages();
    setLoadingEmail(true);
    try {
      const res = await fetch(`/api/boards/${board.id}/email`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEmailSettings(null);
        setSuccess("Email-to-task disabled!");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to disable email-to-task");
      }
    } catch (err) {
      setError("Failed to disable email-to-task");
    } finally {
      setLoadingEmail(false);
    }
  };

  // Copy email to clipboard
  const handleCopyEmail = () => {
    if (emailSettings?.email) {
      navigator.clipboard.writeText(emailSettings.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
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
            { id: "custom-fields", label: "Custom Fields" },
            { id: "integrations", label: "Integrations", show: canEdit },
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

              {/* Pending Invites Section */}
              {canEdit && pendingInvites.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <h4 className="text-sm font-medium text-slate-400 mb-3">
                    Pending Invites ({pendingInvites.length})
                  </h4>
                  <div className="space-y-2">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3 border border-dashed border-slate-600"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-600/50 flex items-center justify-center text-slate-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-white font-medium">{invite.email}</div>
                            <div className="text-slate-400 text-xs flex items-center gap-2">
                              <span className="capitalize">{invite.role}</span>
                              <span>•</span>
                              <span>Expires in {formatExpiry(invite.expiresAt)}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokeInvite(invite.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                          title="Revoke invite"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Fields Tab */}
          {activeTab === "custom-fields" && (
            <CustomFieldManager boardId={board.id} />
          )}

          {/* Integrations Tab */}
          {activeTab === "integrations" && canEdit && (
            <div className="space-y-6">
              {/* Email-to-Task Section */}
              <div className="border border-slate-600 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">Email-to-Task</h3>
                    <p className="text-slate-400 text-sm">Create tasks by sending emails to this board</p>
                  </div>
                </div>

                {loadingEmail ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
                  </div>
                ) : !emailSettings ? (
                  // Not enabled yet
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <p className="text-slate-300 text-sm mb-4">
                      Enable email-to-task to get a unique email address for this board.
                      Anyone who emails this address will create a new task.
                    </p>
                    <button
                      onClick={handleEnableEmail}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium transition-colors"
                    >
                      Enable Email-to-Task
                    </button>
                  </div>
                ) : (
                  // Enabled - show settings
                  <div className="space-y-4">
                    {/* Email address with copy button */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Board Email Address
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white font-mono text-sm">
                          {emailSettings.email}
                        </div>
                        <button
                          onClick={handleCopyEmail}
                          className={`px-3 py-2 rounded font-medium transition-colors flex items-center gap-2 ${
                            emailCopied
                              ? "bg-green-600 text-white"
                              : "bg-slate-600 hover:bg-slate-500 text-white"
                          }`}
                        >
                          {emailCopied ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-slate-700/30 rounded-lg p-4 border border-dashed border-slate-600">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">How it works</h4>
                      <ul className="text-slate-400 text-sm space-y-1">
                        <li>• Forward or send emails to the address above</li>
                        <li>• Email subject becomes the task title</li>
                        <li>• Email body becomes the task description</li>
                        <li>• Sender info is included in the description</li>
                      </ul>
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                      {/* Active toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-slate-300">Enabled</label>
                          <p className="text-slate-500 text-xs">Accept incoming emails</p>
                        </div>
                        <button
                          onClick={() => handleUpdateEmailSettings({ isActive: !emailSettings.isActive })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            emailSettings.isActive ? "bg-indigo-600" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              emailSettings.isActive ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Default column */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Default Column
                        </label>
                        <select
                          value={emailSettings.columnId || ""}
                          onChange={(e) => handleUpdateEmailSettings({ columnId: e.target.value || null })}
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {emailColumns.map((col) => (
                            <option key={col.id} value={col.id}>
                              {col.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-slate-500 text-xs mt-1">
                          New tasks from emails will be added to this column
                        </p>
                      </div>

                      {/* Auto-assign toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-slate-300">Auto-assign to sender</label>
                          <p className="text-slate-500 text-xs">If sender is a board member, assign task to them</p>
                        </div>
                        <button
                          onClick={() => handleUpdateEmailSettings({ autoAssign: !emailSettings.autoAssign })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            emailSettings.autoAssign ? "bg-indigo-600" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              emailSettings.autoAssign ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Require member toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-slate-300">Require membership</label>
                          <p className="text-slate-500 text-xs">Only accept emails from board members</p>
                        </div>
                        <button
                          onClick={() => handleUpdateEmailSettings({ requireMember: !emailSettings.requireMember })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            emailSettings.requireMember ? "bg-indigo-600" : "bg-slate-600"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              emailSettings.requireMember ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Disable button */}
                    {isOwner && (
                      <div className="pt-4 border-t border-slate-700">
                        <button
                          onClick={handleDisableEmail}
                          className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                        >
                          Disable Email-to-Task
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Setup Instructions */}
              <div className="border border-slate-600 rounded-lg p-4">
                <h3 className="text-lg font-medium text-white mb-3">Email Service Setup</h3>
                <p className="text-slate-400 text-sm mb-4">
                  To receive emails, configure your email service to forward incoming mail to this webhook:
                </p>
                <div className="bg-slate-800 rounded-lg p-3 font-mono text-sm text-slate-300 break-all">
                  POST {typeof window !== "undefined" ? window.location.origin : "https://kanban.rhythm.engineering"}/api/webhooks/email
                </div>
                <div className="mt-4 space-y-2 text-slate-400 text-sm">
                  <p><strong className="text-slate-300">Supported services:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>SendGrid Inbound Parse</li>
                    <li>Mailgun Routes</li>
                    <li>Any service that can POST parsed emails as JSON</li>
                  </ul>
                </div>
              </div>
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
