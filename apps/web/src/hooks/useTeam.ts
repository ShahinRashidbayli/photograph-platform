import { useQuery } from '@tanstack/react-query';
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
 * The studio's staff roster.
 *
 * <p>`staleTime: 0` while Settings → Team still writes through its own calls
 * and does not invalidate this key: the cached roster shows instantly, and is
 * revalidated on every mount so a colleague added a moment ago is never
 * missing from a picker. Relax it once that screen moves onto this key.
 */
export function useTeam(enabled = true) {
  return useQuery({
    queryKey: teamKey(),
    enabled,
    staleTime: 0,
    queryFn: async () => (await api.get<Team>('/api/team')).data,
  });
}
