"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { BoardInvite } from "@/types";

interface InviteModalProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function InviteModal({ boardId, isOpen, onClose }: InviteModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [invites, setInvites] = useState<BoardInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchInvites();
    }
  }, [isOpen, boardId]);

  const fetchInvites = async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}/invites`);
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/boards/${boardId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      if (res.ok) {
        const invite = await res.json();
        setInvites([invite, ...invites]);
        setEmail("");
        setSuccess("Invite sent successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send invite");
      }
    } catch (err) {
      setError("Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      const res = await fetch(
        `/api/boards/${boardId}/invites?inviteId=${inviteId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setInvites(invites.filter((i) => i.id !== inviteId));
      }
    } catch (err) {
      console.error("Failed to revoke invite:", err);
    }
  };

  const handleResend = async (invite: BoardInvite) => {
    // Revoke old and create new
    await handleRevoke(invite.id);
    setEmail(invite.email);
    setRole(invite.role);
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const formatExpiry = (date: Date) => {
    const expiry = new Date(date);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Expired";
    if (days === 1) return "Expires in 1 day";
    return `Expires in ${days} days`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Invite Members</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Invite Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="member">Member - Can view and edit tasks</option>
                <option value="admin">Admin - Can manage members and settings</option>
                <option value="owner">Owner - Full control</option>
              </select>
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {success && (
              <div className="text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg px-3 py-2">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? "Sending..." : "Send Invite"}
            </button>
          </form>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-slate-400 mb-3">
                Pending Invites ({invites.length})
              </h3>
              <div className="space-y-3">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{invite.email}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span className="capitalize">{invite.role}</span>
                        <span>•</span>
                        <span>{formatExpiry(invite.expiresAt)}</span>
                        {invite.invitedBy && (
                          <>
                            <span>•</span>
                            <span>by {invite.invitedBy.name || invite.invitedBy.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={() => copyInviteLink(invite.token)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                        title="Copy invite link"
                      >
                        {copiedToken === invite.token ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleResend(invite)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                        title="Resend invite"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                        title="Revoke invite"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
