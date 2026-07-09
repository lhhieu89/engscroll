"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

interface AuthUser {
  name: string | null;
  email: string | null;
}
interface AuthState {
  user: AuthUser | null;
  loaded: boolean;
}

const AuthCtx = createContext<AuthState>({ user: null, loaded: false });

export function useAuth() {
  return useContext(AuthCtx);
}

// One shared fetch of the auth state for the whole shell (TopBar button, Sidebar,
// BottomNav) instead of each component hitting /api/auth/me. Refreshes on route
// change and on the "engscroll:auth-changed" event fired at login/logout.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loaded: false });
  const pathname = usePathname();

  useEffect(() => {
    let live = true;
    const refresh = () =>
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => {
          if (live) setState({ user: d.user, loaded: true });
        })
        .catch(() => live && setState((s) => ({ ...s, loaded: true })));
    refresh();
    window.addEventListener("engscroll:auth-changed", refresh);
    return () => {
      live = false;
      window.removeEventListener("engscroll:auth-changed", refresh);
    };
  }, [pathname]);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}
