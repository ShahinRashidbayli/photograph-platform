import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export type StaffRole = 'OWNER' | 'MEMBER';

/** Mirrors `TeamResponse.members[]` on the API. */
export interface TeamMember {
  id: string;
  email: string;
  fullName: string | null;
  staffRole: StaffRole;
  avatarUrl: string | null;
}

/** Mirrors `TeamResponse` on the API. */
export interface Team {
  members: TeamMember[];
  invitations: {
    id: string;
    email: string;
    status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
    expiresAt: string;
    createdAt: string;
  }[];
  seatsUsed: number;
  seatsTotal: number;
  canManage: boolean;
}

export function teamKey() {
  return ['team'] as const;
}

/**
 * The studio's staff roster, its open invitations and its seats. Every
 * mutation below refreshes it, so a colleague added in Settings is in the
 * booking form's picker the next time it opens.
 */
export function useTeam(enabled = true) {
  return useQuery({
    queryKey: teamKey(),
    enabled,
    queryFn: async () => (await api.get<Team>('/api/team')).data,
  });
}

function useTeamMutation<T>(mutationFn: (_input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKey() }),
  });
}

export function useInviteMember() {
  return useTeamMutation((email: string) => api.post('/api/team/invitations', { email }));
}

export function useRevokeInvitation() {
  return useTeamMutation((id: string) => api.delete(`/api/team/invitations/${id}`));
}

export function useRemoveMember() {
  return useTeamMutation((memberId: string) => api.delete(`/api/team/members/${memberId}`));
}

/**
 * Hands the studio to another member. No cache work: the caller stops being
 * the owner in the same request, so the screen reloads the page instead.
 */
export function useTransferOwnership() {
  return useMutation({
    mutationFn: (memberId: string) => api.post('/api/team/transfer-ownership', { memberId }),
  });
}

/** Leaves the studio. The account is gone once it resolves; the caller navigates away. */
export function useLeaveStudio() {
  return useMutation({ mutationFn: () => api.post('/api/team/leave') });
}
