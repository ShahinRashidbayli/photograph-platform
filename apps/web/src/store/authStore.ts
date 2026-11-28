import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  emailVerified: boolean;
  tenant: { subdomain: string; plan: string };
  avatarUrl?: string | null;
  /** The UI language the emails Fotolio sends this user are written in. */
  language?: 'de' | 'en';
}

interface AuthState {
  user: AuthUser | null;
  setUser: (_user: AuthUser) => void;
  /** Clears client-side state only — does NOT call the logout API. */
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (_user) => set({ user: _user }),
  clearUser: () => set({ user: null }),
}));

/**
 * True when the signed-in user is studio staff (photographer/admin) rather than
 * a customer. This distinction gates most role-aware UI, so it lives here as a
 * single selector instead of being re-derived in every page/component.
 */
export const isPhotographerRole = (role: string | undefined | null): boolean => {
  const r = role?.toUpperCase();
  return r === 'PHOTOGRAPHER' || r === 'ADMIN';
};

/** Selector hook: is the current user a photographer/admin (vs. a customer)? */
export const useIsPhotographer = (): boolean =>
  useAuthStore((s) => isPhotographerRole(s.user?.role));
