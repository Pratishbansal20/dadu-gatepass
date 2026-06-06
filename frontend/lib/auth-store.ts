"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  phone: string;
  campus_id: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isLoggedIn: true }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false }),
    }),
    { name: "gatepass-auth" },
  ),
);
