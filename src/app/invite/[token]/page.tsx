"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

interface InviteData {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  board: {
    id: string;
    name: string;
    description: string | null;
  };
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export default function InvitePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInvite();
  }, [token]);

  const fetchInvite = async () => {
    try {
      const res = await fetch(`/api/invites/${token}`);
      if (res.ok) {
        const data = await res.json();
        setInvite(data);
      } else {
        const data = await res.json();
        setError(data.error || "Invalid invite");
      }
    } catch (err) {
      setError("Failed to load invite");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!session) {
      // Store token in sessionStorage and redirect to sign in
      sessionStorage.setItem("pendingInviteToken", token);
      signIn("google", { callbackUrl: `/invite/${token}` });
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${token}`, { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        router.push(`/boards/${data.boardId}`);
      } else {
        setError(data.error || "Failed to accept invite");
      }
    } catch (err) {
      setError("Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  };

  // Auto-accept if user just signed in with pending invite
  useEffect(() => {
    if (status === "authenticated" && session) {
      const pendingToken = sessionStorage.getItem("pendingInviteToken");
      if (pendingToken === token) {
        sessionStorage.removeItem("pendingInviteToken");
        handleAccept();
      }
    }
  }, [status, session, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">
            {error === "Invite has expired" ? "Invite Expired" : "Invalid Invite"}
          </h1>
          <p className="text-slate-400 mb-6">
            {error === "Invite has expired"
              ? "This invite link has expired. Please ask the board owner to send a new invite."
              : "This invite link is not valid. It may have been revoked or already used."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  const roleLabels: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full">
        {/* Board Info */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            You&apos;re invited to join
          </h1>
          <h2 className="text-xl text-indigo-400 font-semibold">
            {invite.board.name}
          </h2>
          {invite.board.description && (
            <p className="text-slate-400 mt-2 text-sm">
              {invite.board.description}
            </p>
          )}
        </div>

        {/* Inviter Info */}
        <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            {invite.invitedBy.image ? (
              <Image
                src={invite.invitedBy.image}
                alt={invite.invitedBy.name || "Inviter"}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
                <span className="text-slate-300 font-medium">
                  {(invite.invitedBy.name || invite.invitedBy.email)[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-white font-medium">
                {invite.invitedBy.name || invite.invitedBy.email}
              </p>
              <p className="text-slate-400 text-sm">invited you as {roleLabels[invite.role]}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {session ? (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {accepting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  Accepting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Accept Invite
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleAccept}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Sign in to Accept
            </button>
          )}

          <button
            onClick={() => router.push("/")}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 rounded-lg font-medium transition-colors"
          >
            Decline
          </button>
        </div>

        {/* Current user info */}
        {session && (
          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm">
              Signed in as{" "}
              <span className="text-white">{session.user?.email}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
