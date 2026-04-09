import { useState, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export type AuthUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  karma: number;
  buildSubmissions: number;
  createdAt: string;
};

// Global auth state (persists across renders, lost on page refresh since localStorage is blocked)
let globalUser: AuthUser | null = null;
let listeners: (() => void)[] = [];

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function useAuth() {
  const [, setTick] = useState(0);

  // Subscribe to auth changes
  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    globalUser = await res.json();
    notifyListeners();
    return globalUser!;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { username, password });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration failed");
    }
    globalUser = await res.json();
    notifyListeners();
    return globalUser!;
  }, []);

  const logout = useCallback(() => {
    globalUser = null;
    notifyListeners();
  }, []);

  const refreshUser = useCallback(async () => {
    if (!globalUser) return;
    try {
      const res = await apiRequest("GET", `/api/users/${globalUser.id}`);
      if (res.ok) {
        const data = await res.json();
        globalUser = { ...globalUser, karma: data.karma, buildSubmissions: data.buildSubmissions };
        notifyListeners();
      }
    } catch {}
  }, []);

  return {
    user: globalUser,
    login,
    register,
    logout,
    refreshUser,
    isLoggedIn: !!globalUser,
    isAdmin: globalUser?.isAdmin ?? false,
  };
}
