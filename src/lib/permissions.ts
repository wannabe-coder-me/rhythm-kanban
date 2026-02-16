/**
 * RBAC Permission Helpers for Rhythm Kanban
 * 
 * System Roles: admin | manager | user
 * Board Roles: admin | member | viewer
 */

import { Board, BoardMember, User } from "@prisma/client";

type BoardWithOwner = Board & { 
  ownerId: string;
  members?: BoardMember[];
};

type UserWithRole = Pick<User, 'id' | 'role'>;

// ============================================
// System Role Checks
// ============================================

export function isAdmin(user: UserWithRole): boolean {
  return user.role === 'admin';
}

export function isManager(user: UserWithRole): boolean {
  return user.role === 'manager';
}

export function isSystemPrivileged(user: UserWithRole): boolean {
  return isAdmin(user) || isManager(user);
}

// ============================================
// Board Role Helpers
// ============================================

export type BoardRole = 'owner' | 'admin' | 'member' | 'viewer' | null;

export function getBoardRole(
  userId: string, 
  board: BoardWithOwner, 
  membership?: BoardMember | null
): BoardRole {
  // Check if user is the board owner
  if (board.ownerId === userId) {
    return 'owner';
  }
  
  // Check membership if provided directly
  if (membership) {
    return membership.role as 'admin' | 'member' | 'viewer';
  }
  
  // Check membership from board.members if available
  if (board.members) {
    const member = board.members.find(m => m.userId === userId);
    if (member) {
      return member.role as 'admin' | 'member' | 'viewer';
    }
  }
  
  return null;
}

// ============================================
// Board Permission Checks
// ============================================

/**
 * Can user view this board?
 * - System admins can view all boards
 * - Board owner, members (any role) can view
 * - Team visibility: all authenticated users
 * - Public visibility: anyone
 */
export function canViewBoard(
  user: UserWithRole,
  board: BoardWithOwner,
  membership?: BoardMember | null
): boolean {
  // System admins can view everything
  if (isAdmin(user)) return true;
  
  // Owner can always view
  if (board.ownerId === user.id) return true;
  
  // Members can view
  const role = getBoardRole(user.id, board, membership);
  if (role) return true;
  
  // Team visibility = all authenticated users
  if (board.visibility === 'team') return true;
  
  // Public boards - anyone can view
  if (board.visibility === 'public') return true;
  
  return false;
}

/**
 * Can user edit board settings (name, description, visibility)?
 * - System admins can edit all
 * - Board owner can edit
 * - Board admins can edit
 */
export function canEditBoard(
  user: UserWithRole,
  board: BoardWithOwner,
  membership?: BoardMember | null
): boolean {
  if (isAdmin(user)) return true;
  if (board.ownerId === user.id) return true;
  
  const role = getBoardRole(user.id, board, membership);
  return role === 'admin';
}

/**
 * Can user delete this board?
 * - System admins can delete any board
 * - Only board owner can delete
 */
export function canDeleteBoard(
  user: UserWithRole,
  board: BoardWithOwner
): boolean {
  if (isAdmin(user)) return true;
  return board.ownerId === user.id;
}

/**
 * Can user invite others to this board?
 * - System admins can invite
 * - Board owner can invite
 * - Board admins can invite
 */
export function canInviteToBoard(
  user: UserWithRole,
  board: BoardWithOwner,
  membership?: BoardMember | null
): boolean {
  if (isAdmin(user)) return true;
  if (board.ownerId === user.id) return true;
  
  const role = getBoardRole(user.id, board, membership);
  return role === 'admin';
}

/**
 * Can user manage board members (change roles, remove)?
 * - System admins can manage
 * - Board owner can manage
 * - Board admins can manage members/viewers (not other admins)
 */
export function canManageMembers(
  user: UserWithRole,
  board: BoardWithOwner,
  membership?: BoardMember | null,
  targetMembership?: BoardMember | null
): boolean {
  if (isAdmin(user)) return true;
  if (board.ownerId === user.id) return true;
  
  const role = getBoardRole(user.id, board, membership);
  if (role !== 'admin') return false;
  
  // Board admins can only manage non-admins
  if (targetMembership && targetMembership.role === 'admin') {
    return false;
  }
  
  return true;
}

/**
 * Can user create/edit/delete tasks on this board?
 * - System admins can edit all
 * - Board owner can edit
 * - Board admins can edit
 * - Board members can edit
 * - Viewers cannot edit
 */
export function canEditTasks(
  user: UserWithRole,
  board: BoardWithOwner,
  membership?: BoardMember | null
): boolean {
  if (isAdmin(user)) return true;
  if (board.ownerId === user.id) return true;
  
  const role = getBoardRole(user.id, board, membership);
  return role === 'admin' || role === 'member';
}

/**
 * Can user manage columns (create, edit, delete, reorder)?
 * - System admins can manage
 * - Board owner can manage
 * - Board admins can manage
 */
export function canManageColumns(
  user: UserWithRole,
  board: BoardWithOwner,
  membership?: BoardMember | null
): boolean {
  if (isAdmin(user)) return true;
  if (board.ownerId === user.id) return true;
  
  const role = getBoardRole(user.id, board, membership);
  return role === 'admin';
}

/**
 * Can user manage labels (create, edit, delete)?
 * - System admins can manage
 * - Board owner can manage  
 * - Board admins can manage
 * - Members can manage (labels are collaborative)
 */
export function canManageLabels(
  user: UserWithRole,
  board: BoardWithOwner,
  membership?: BoardMember | null
): boolean {
  if (isAdmin(user)) return true;
  if (board.ownerId === user.id) return true;
  
  const role = getBoardRole(user.id, board, membership);
  return role === 'admin' || role === 'member';
}
