import { create } from 'zustand';
import type { AuthUser } from './types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrating: boolean;
  bootstrapError: string | null;
  setSession: (user: AuthUser, accessToken: string, refreshToken: string | null) => void;
  clearSession: () => void;
  setHydrating: (isHydrating: boolean) => void;
  setBootstrapError: (message: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isHydrating: true,
  bootstrapError: null,
  setSession: (user, accessToken, refreshToken) =>
    set({ user, accessToken, refreshToken, isHydrating: false, bootstrapError: null }),
  clearSession: () => set({ user: null, accessToken: null, refreshToken: null }),
  setHydrating: (isHydrating) => set({ isHydrating }),
  setBootstrapError: (bootstrapError) => set({ bootstrapError }),
}));
