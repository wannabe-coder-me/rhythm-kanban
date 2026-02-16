"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ToastContainer, useToasts } from "@/components/Toast";

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  lastActiveAt: string | null;
  createdAt: string;
  _count: {
    ownedBoards: number;
    boardMembers: number;
  };
}

interface UserDetails extends User {
  ownedBoards: {
    id: string;
    name: string;
    visibility: string;
    createdAt: string;
    _count: { members: number };
  }[];
  boardMembers: {
    role: string;
    board: {
      id: string;
      name: string;
      visibility: string;
      owner: { id: string; name: string | null; email: string };
    };
  }[];
}

interface Board {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  owner: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  _count: {
    members: number;
  };
}

interface Stats {
  users: {
    total: number;
    byRole: { admin: number; manager: number; user: number };
    activeLastWeek: number;
  };
  boards: {
    total: number;
    byVisibility: { private: number; team: number; public: number };
  };
}

type TabType = "users" | "boards" | "settings";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toasts, addToast, dismissToast } = useToasts();
  
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // User modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState<{ user: User; action: "delete" | "transfer"; transferTo: string }>({ user: null as unknown as User, action: "delete", transferTo: "" });
  
  // Board modals
  const [showBoardDetailModal, setShowBoardDetailModal] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [showDeleteBoardModal, setShowDeleteBoardModal] = useState(false);
  const [showTransferOwnershipModal, setShowTransferOwnershipModal] = useState(false);
  
  // Add user form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("user");
  
  // Filters
  const [boardOwnerFilter, setBoardOwnerFilter] = useState("");
  const [boardVisibilityFilter, setBoardVisibilityFilter] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, []);

  const fetchBoards = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (boardOwnerFilter) params.set("ownerId", boardOwnerFilter);
      if (boardVisibilityFilter) params.set("visibility", boardVisibilityFilter);
      
      const res = await fetch(`/api/admin/boards?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBoards(data);
      }
    } catch (err) {
      console.error("Failed to fetch boards:", err);
    }
  }, [boardOwnerFilter, boardVisibilityFilter]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
    if (session.user.role !== "admin") {
      router.push("/");
      return;
    }
    
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchUsers(), fetchBoards()]);
      setLoading(false);
    };
    loadData();
  }, [session, status, router, fetchStats, fetchUsers, fetchBoards]);

  useEffect(() => {
    if (activeTab === "boards") {
      fetchBoards();
    }
  }, [boardOwnerFilter, boardVisibilityFilter, activeTab, fetchBoards]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName, role: newRole }),
      });
      
      if (res.ok) {
        setShowAddUserModal(false);
        setNewEmail("");
        setNewName("");
        setNewRole("user");
        fetchUsers();
        fetchStats();
        addToast("User added successfully", "success");
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to add user", "error");
      }
    } catch {
      addToast("Failed to add user", "error");
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (res.ok) {
        fetchUsers();
        fetchStats();
        addToast("Role updated successfully", "success");
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to update role", "error");
      }
    } catch {
      addToast("Failed to update role", "error");
    }
  };

  const openUserDetail = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data);
        setShowUserDetailModal(true);
      }
    } catch (err) {
      console.error("Failed to fetch user details:", err);
      addToast("Failed to load user details", "error");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserData.user) return;
    
    try {
      const params = new URLSearchParams();
      params.set("boardAction", deleteUserData.action);
      if (deleteUserData.action === "transfer" && deleteUserData.transferTo) {
        params.set("transferToUserId", deleteUserData.transferTo);
      }
      
      const res = await fetch(`/api/admin/users/${deleteUserData.user.id}?${params}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        setShowDeleteUserModal(false);
        setShowUserDetailModal(false);
        fetchUsers();
        fetchBoards();
        fetchStats();
        addToast("User deleted successfully", "success");
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to delete user", "error");
      }
    } catch {
      addToast("Failed to delete user", "error");
    }
  };

  const handleUpdateBoard = async (boardId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/boards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      
      if (res.ok) {
        fetchBoards();
        fetchStats();
        setShowBoardDetailModal(false);
        setShowTransferOwnershipModal(false);
        addToast("Board updated successfully", "success");
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to update board", "error");
      }
    } catch {
      addToast("Failed to update board", "error");
    }
  };

  const handleDeleteBoard = async () => {
    if (!selectedBoard) return;
    
    try {
      const res = await fetch(`/api/admin/boards/${selectedBoard.id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        setShowDeleteBoardModal(false);
        setShowBoardDetailModal(false);
        setSelectedBoard(null);
        fetchBoards();
        fetchStats();
        addToast("Board deleted successfully", "success");
      } else {
        const data = await res.json();
        addToast(data.error || "Failed to delete board", "error");
      }
    } catch {
      addToast("Failed to delete board", "error");
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatRelativeDate = (date: string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return formatDate(date);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (session?.user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-gray-400">System administration</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm"
            >
              ← Back to Boards
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Dashboard */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-3xl font-bold text-indigo-400">{stats.users.total}</div>
              <div className="text-gray-400 text-sm mt-1">Total Users</div>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="px-2 py-1 bg-red-900/50 text-red-300 rounded">{stats.users.byRole.admin} admin</span>
                <span className="px-2 py-1 bg-yellow-900/50 text-yellow-300 rounded">{stats.users.byRole.manager} mgr</span>
                <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded">{stats.users.byRole.user} user</span>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-3xl font-bold text-emerald-400">{stats.users.activeLastWeek}</div>
              <div className="text-gray-400 text-sm mt-1">Active This Week</div>
              <div className="mt-3 text-xs text-gray-500">
                {stats.users.total > 0 ? Math.round((stats.users.activeLastWeek / stats.users.total) * 100) : 0}% of users
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-3xl font-bold text-blue-400">{stats.boards.total}</div>
              <div className="text-gray-400 text-sm mt-1">Total Boards</div>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded">{stats.boards.byVisibility.private} priv</span>
                <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded">{stats.boards.byVisibility.team} team</span>
                <span className="px-2 py-1 bg-emerald-900/50 text-emerald-300 rounded">{stats.boards.byVisibility.public} pub</span>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="text-3xl font-bold text-amber-400">
                {stats.users.total > 0 ? (stats.boards.total / stats.users.total).toFixed(1) : 0}
              </div>
              <div className="text-gray-400 text-sm mt-1">Boards per User</div>
              <div className="mt-3 text-xs text-gray-500">Average</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
          {(["users", "boards", "settings"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-md text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition text-sm"
              >
                + Add User
              </button>
            </div>
            
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">User</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Role</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Joined</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Last Active</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Boards</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-750/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <img src={user.image} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-lg font-semibold">
                              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{user.name || "—"}</div>
                            <div className="text-sm text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          disabled={user.id === session?.user.id}
                          className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="user">User</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {formatRelativeDate(user.lastActiveAt)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="text-indigo-400">{user._count.ownedBoards}</span>
                        <span className="text-gray-500"> owned</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openUserDetail(user.id)}
                            className="text-indigo-400 hover:text-indigo-300 text-sm"
                          >
                            Edit
                          </button>
                          {user.id !== session?.user.id && (
                            <button
                              onClick={() => {
                                setDeleteUserData({ user, action: "delete", transferTo: "" });
                                setShowDeleteUserModal(true);
                              }}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {users.length === 0 && (
                <div className="text-center py-12 text-gray-400">No users found</div>
              )}
            </div>
          </div>
        )}

        {/* Boards Tab */}
        {activeTab === "boards" && (
          <div>
            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <select
                value={boardOwnerFilter}
                onChange={(e) => setBoardOwnerFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm"
              >
                <option value="">All Owners</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
              <select
                value={boardVisibilityFilter}
                onChange={(e) => setBoardVisibilityFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm"
              >
                <option value="">All Visibility</option>
                <option value="private">Private</option>
                <option value="team">Team</option>
                <option value="public">Public</option>
              </select>
            </div>
            
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Board</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Owner</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Visibility</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Members</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">Created</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {boards.map((board) => (
                    <tr key={board.id} className="hover:bg-gray-750/50">
                      <td className="px-6 py-4">
                        <div className="font-medium">{board.name}</div>
                        {board.description && (
                          <div className="text-sm text-gray-400 truncate max-w-xs">{board.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {board.owner.image ? (
                            <img src={board.owner.image} alt="" className="w-6 h-6 rounded-full" />
                          ) : (
                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-xs">
                              {board.owner.name?.[0]?.toUpperCase() || board.owner.email[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm">{board.owner.name || board.owner.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          board.visibility === "public"
                            ? "bg-emerald-900/50 text-emerald-300"
                            : board.visibility === "team"
                            ? "bg-blue-900/50 text-blue-300"
                            : "bg-gray-700 text-gray-300"
                        }`}>
                          {board.visibility}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {board._count.members}
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {formatDate(board.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/board/${board.id}`)}
                            className="text-gray-400 hover:text-gray-300 text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBoard(board);
                              setShowBoardDetailModal(true);
                            }}
                            className="text-indigo-400 hover:text-indigo-300 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBoard(board);
                              setShowDeleteBoardModal(true);
                            }}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {boards.length === 0 && (
                <div className="text-center py-12 text-gray-400">No boards found</div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="bg-gray-800 rounded-xl p-8">
            <h3 className="text-xl font-semibold mb-4">System Settings</h3>
            <p className="text-gray-400">Settings configuration coming soon.</p>
            
            <div className="mt-8 p-4 bg-gray-700/50 rounded-lg">
              <h4 className="font-medium mb-2">Current Session</h4>
              <div className="text-sm text-gray-400 space-y-1">
                <div>User: {session?.user.name || session?.user.email}</div>
                <div>Role: {session?.user.role}</div>
                <div>ID: {session?.user.id}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add New User</h2>
            <form onSubmit={handleAddUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                  placeholder="user@example.com"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                  placeholder="John Doe"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">System Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {showUserDetailModal && selectedUser && (
        <UserDetailModal
          user={selectedUser}
          currentUserId={session?.user.id || ""}
          onClose={() => {
            setShowUserDetailModal(false);
            setSelectedUser(null);
          }}
          onSave={async (updates) => {
            try {
              const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
              });
              if (res.ok) {
                fetchUsers();
                fetchStats();
                setShowUserDetailModal(false);
                setSelectedUser(null);
                addToast("User updated successfully", "success");
              } else {
                const data = await res.json();
                addToast(data.error || "Failed to update user", "error");
              }
            } catch {
              addToast("Failed to update user", "error");
            }
          }}
          onDelete={() => {
            setDeleteUserData({ user: selectedUser, action: "delete", transferTo: "" });
            setShowDeleteUserModal(true);
          }}
        />
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteUserModal && deleteUserData.user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-red-400">Delete User</h2>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete <strong>{deleteUserData.user.name || deleteUserData.user.email}</strong>?
            </p>
            
            {deleteUserData.user._count.ownedBoards > 0 && (
              <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                <p className="text-yellow-300 text-sm mb-3">
                  This user owns {deleteUserData.user._count.ownedBoards} board(s). What should happen to them?
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="boardAction"
                      value="delete"
                      checked={deleteUserData.action === "delete"}
                      onChange={() => setDeleteUserData(d => ({ ...d, action: "delete" }))}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">Delete all boards</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="boardAction"
                      value="transfer"
                      checked={deleteUserData.action === "transfer"}
                      onChange={() => setDeleteUserData(d => ({ ...d, action: "transfer" }))}
                      className="text-indigo-600"
                    />
                    <span className="text-sm">Transfer to another user</span>
                  </label>
                </div>
                
                {deleteUserData.action === "transfer" && (
                  <select
                    value={deleteUserData.transferTo}
                    onChange={(e) => setDeleteUserData(d => ({ ...d, transferTo: e.target.value }))}
                    className="mt-3 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select user...</option>
                    {users.filter(u => u.id !== deleteUserData.user.id).map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteUserModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteUserData.action === "transfer" && !deleteUserData.transferTo}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board Detail Modal */}
      {showBoardDetailModal && selectedBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Edit Board</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                handleUpdateBoard(selectedBoard.id, {
                  name: formData.get("name"),
                  visibility: formData.get("visibility"),
                });
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={selectedBoard.name}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">Visibility</label>
                <select
                  name="visibility"
                  defaultValue={selectedBoard.visibility}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                >
                  <option value="private">Private</option>
                  <option value="team">Team</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Owner</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-300">
                    {selectedBoard.owner.name || selectedBoard.owner.email}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTransferOwnershipModal(true)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition text-sm"
                  >
                    Transfer
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setShowDeleteBoardModal(true)}
                  className="px-4 py-2 text-red-400 hover:text-red-300 text-sm"
                >
                  Delete Board
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBoardDetailModal(false);
                      setSelectedBoard(null);
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferOwnershipModal && selectedBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Transfer Ownership</h2>
            <p className="text-gray-400 text-sm mb-4">
              Transfer &quot;{selectedBoard.name}&quot; to a new owner.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const newOwnerId = formData.get("ownerId") as string;
                if (newOwnerId) {
                  handleUpdateBoard(selectedBoard.id, { ownerId: newOwnerId });
                }
              }}
            >
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">New Owner</label>
                <select
                  name="ownerId"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">Select user...</option>
                  {users.filter(u => u.id !== selectedBoard.owner.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTransferOwnershipModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
                >
                  Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Board Confirmation Modal */}
      {showDeleteBoardModal && selectedBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-red-400">Delete Board</h2>
            <p className="text-gray-300 mb-2">
              Are you sure you want to delete <strong>{selectedBoard.name}</strong>?
            </p>
            <p className="text-gray-400 text-sm mb-6">
              This will permanently delete all columns, tasks, comments, and attachments. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteBoardModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBoard}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
              >
                Delete Board
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// User Detail Modal Component
function UserDetailModal({
  user,
  currentUserId,
  onClose,
  onSave,
  onDelete,
}: {
  user: UserDetails;
  currentUserId: string;
  onClose: () => void;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  const isSelf = user.id === currentUserId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, email, role });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            {user.image ? (
              <img src={user.image} alt="" className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-2xl font-semibold">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{user.name || user.email}</h2>
              <p className="text-gray-400 text-sm">
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">System Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSelf}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            {isSelf && (
              <p className="text-yellow-500 text-xs mt-1">You cannot change your own role</p>
            )}
          </div>

          {/* Owned Boards */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              Owned Boards ({user.ownedBoards.length})
            </h3>
            {user.ownedBoards.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {user.ownedBoards.map((board) => (
                  <div key={board.id} className="flex items-center justify-between bg-gray-700/50 px-3 py-2 rounded">
                    <span className="text-sm">{board.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      board.visibility === "public"
                        ? "bg-emerald-900/50 text-emerald-300"
                        : board.visibility === "team"
                        ? "bg-blue-900/50 text-blue-300"
                        : "bg-gray-600 text-gray-300"
                    }`}>
                      {board.visibility}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No boards owned</p>
            )}
          </div>

          {/* Member of Boards */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              Member of Boards ({user.boardMembers.length})
            </h3>
            {user.boardMembers.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {user.boardMembers.map((membership) => (
                  <div key={membership.board.id} className="flex items-center justify-between bg-gray-700/50 px-3 py-2 rounded">
                    <div>
                      <span className="text-sm">{membership.board.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        (by {membership.board.owner.name || membership.board.owner.email})
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs bg-indigo-900/50 text-indigo-300">
                      {membership.role}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Not a member of any boards</p>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-gray-700">
            {!isSelf ? (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 text-red-400 hover:text-red-300 text-sm"
              >
                Delete User
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
