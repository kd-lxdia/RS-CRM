import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// Keep the browser bundle independent from the backend workspace package.
// The role values are part of the API contract and are persisted in auth state.
export type UserRole =
  | 'ADMIN' | 'CALLING_STAFF' | 'SALESPERSON' | 'PROJECT_HEAD'
  | 'DOCUMENTATION' | 'WAREHOUSE' | 'INSTALLATION' | 'ACCOUNTANT'
  | 'DEALER_ADMIN' | 'DEALER_STAFF';

interface User {
  id: string;
  name: string;
  role: UserRole;
  dealerId: string | null;
  zoneId: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  login: (accessToken: string, refreshToken: string, user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      login: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'slarcrm-auth' }
  )
);
