"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "../api-client/client";

interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
}

interface Store {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
}

interface StoreMembership {
  storeId: string;
  userId: string;
  role: string;
  status: string;
  store: Store;
}

interface AuthContextType {
  user: User | null;
  activeStore: Store | null;
  storeMemberships: StoreMembership[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  switchStore: (storeId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [storeMemberships, setStoreMemberships] = useState<StoreMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("salesense_access_token");
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await apiClient.get("/auth/me");
        setUser(profile as unknown as User);
        setStoreMemberships(profile.storeMemberships || []);

        const storedStoreId = localStorage.getItem("salesense_active_store_id");
        if (storedStoreId && profile.storeMemberships) {
          const membership = profile.storeMemberships.find((m: any) => m.storeId === storedStoreId);
          if (membership) {
            setActiveStore(membership.store);
          } else if (profile.storeMemberships.length > 0) {
            setActiveStore(profile.storeMemberships[0].store);
            localStorage.setItem("salesense_active_store_id", profile.storeMemberships[0].storeId);
          }
        } else if (profile.storeMemberships && profile.storeMemberships.length > 0) {
          setActiveStore(profile.storeMemberships[0].store);
          localStorage.setItem("salesense_active_store_id", profile.storeMemberships[0].storeId);
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (data: any) => {
    const res = await apiClient.post("/auth/login", data);
    localStorage.setItem("salesense_access_token", res.accessToken);
    localStorage.setItem("salesense_refresh_token", res.refreshToken);
    
    // Fetch profile to get store memberships
    const profile = await apiClient.get("/auth/me");
    setUser(profile as unknown as User);
    setStoreMemberships(profile.storeMemberships || []);
    if (profile.storeMemberships && profile.storeMemberships.length > 0) {
      setActiveStore(profile.storeMemberships[0].store);
      localStorage.setItem("salesense_active_store_id", profile.storeMemberships[0].storeId);
    }
  };

  const register = async (data: any) => {
    const res = await apiClient.post("/auth/register", data);
    localStorage.setItem("salesense_access_token", res.accessToken);
    localStorage.setItem("salesense_refresh_token", res.refreshToken);
    localStorage.setItem("salesense_active_store_id", res.store.id);
    
    setUser(res.user);
    setActiveStore(res.store);
    setStoreMemberships([
      {
        storeId: res.store.id,
        userId: res.user.id,
        role: "OWNER",
        status: "ACTIVE",
        store: res.store,
      },
    ]);
  };

  const logout = () => {
    // Fire and forget — sends the refresh token so the server revokes the
    // whole session family (design doc 0010); then clear locally regardless.
    const refreshToken = localStorage.getItem("salesense_refresh_token");
    apiClient.post("/auth/logout", refreshToken ? { refreshToken } : {}).catch(() => {});
    localStorage.removeItem("salesense_access_token");
    localStorage.removeItem("salesense_refresh_token");
    localStorage.removeItem("salesense_active_store_id");
    setUser(null);
    setActiveStore(null);
    setStoreMemberships([]);
    window.location.href = "/login";
  };

  const switchStore = (storeId: string) => {
    const membership = storeMemberships.find((m) => m.storeId === storeId);
    if (membership) {
      setActiveStore(membership.store);
      localStorage.setItem("salesense_active_store_id", storeId);
      window.location.reload(); // Reload to fetch store-specific data
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeStore,
        storeMemberships,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchStore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
