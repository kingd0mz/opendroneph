import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

import { LoginModal } from "../components/LoginModal";
import { ApiError } from "../services/api";
import {
  ensureCsrfCookie,
  fetchCurrentUser as fetchCurrentUserRequest,
  login as loginRequest,
  logout as logoutRequest,
} from "../services/users";
import type { AuthUser } from "../types/user";

type PendingAction = (() => void | Promise<void>) | null;

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<AuthUser | null>;
  openLoginModal: (action?: () => void | Promise<void>) => void;
  requireAuth: (action: () => void | Promise<void>) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const pendingActionRef = useRef<PendingAction>(null);

  async function fetchCurrentUser() {
    try {
      const currentUser = await fetchCurrentUserRequest();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
        setUser(null);
        return null;
      }
      throw error;
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      try {
        await ensureCsrfCookie();
        const currentUser = await fetchCurrentUser();
        if (!active) {
          return;
        }
        setUser(currentUser);
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrapAuth();

    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string) {
    const currentUser = await loginRequest(email, password);
    setUser(currentUser);
    return currentUser;
  }

  async function logout() {
    await logoutRequest();
    setUser(null);
  }

  function openLoginModal(action?: () => void | Promise<void>) {
    pendingActionRef.current = action ?? null;
    setIsLoginOpen(true);
  }

  async function requireAuth(action: () => void | Promise<void>) {
    if (!user) {
      openLoginModal(action);
      return false;
    }

    await action();
    return true;
  }

  function closeLoginModal() {
    pendingActionRef.current = null;
    setIsLoginOpen(false);
  }

  function handleLoginSuccess() {
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsLoginOpen(false);

    if (pendingAction) {
      void pendingAction();
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      fetchCurrentUser,
      openLoginModal,
      requireAuth,
    }),
    [loading, user],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginModal open={isLoginOpen} onClose={closeLoginModal} onSuccess={handleLoginSuccess} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
