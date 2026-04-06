import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenant: { subdomain: string; plan: string };
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
