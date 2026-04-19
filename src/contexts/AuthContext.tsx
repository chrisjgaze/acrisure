import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: string | null;
  tenantId: string | null;
  logoUrl: string | null;
  isAdmin: boolean;
  licensedClasses: string[];
  displayName: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Fetch user profile using raw fetch — no GoTrueClient lock contention,
// no extra client instances. Safe to call inside onAuthStateChange.
async function fetchTenantLogo(tenantId: string, accessToken: string): Promise<string | null> {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tenants?select=logo_url&id=eq.${tenantId}&limit=1`;
    const resp = await fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!resp.ok) return null;
    const rows = await resp.json() as { logo_url: string | null }[];
    return rows[0]?.logo_url ?? null;
  } catch {
    return null;
  }
}

async function fetchUserProfile(userId: string, accessToken: string) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/users?select=role,tenant_id,is_admin,licensed_classes,first_name,last_name&id=eq.${userId}&limit=1`;
  try {
    const resp = await fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!resp.ok) {
      console.error("Failed to fetch user profile: HTTP", resp.status, await resp.text());
      return { role: null, tenantId: null };
    }
    const rows = await resp.json() as { role: string; tenant_id: string; is_admin: boolean; licensed_classes: string[]; first_name: string | null; last_name: string | null }[];
    if (!rows.length) {
      console.error("Failed to fetch user profile: no row found for user", userId);
      return { role: null, tenantId: null, isAdmin: false, licensedClasses: ["trade_credit"] };
    }
    const first = rows[0].first_name?.trim() || null;
    const last  = rows[0].last_name?.trim()  || null;
    return {
      role: rows[0].role ?? null,
      tenantId: rows[0].tenant_id ?? null,
      isAdmin: (rows[0].is_admin ?? false) || rows[0].role === "platform_admin",
      licensedClasses: rows[0].licensed_classes ?? ["trade_credit"],
      displayName: first || last ? [first, last].filter(Boolean).join(" ") : null,
    };
  } catch (err) {
    console.error("Failed to fetch user profile:", err);
    return { role: null, tenantId: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [licensedClasses, setLicensedClasses] = useState<string[]>(["trade_credit"]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track whether the SIGNED_IN should trigger navigation
  const shouldNavigateOnSignIn = useRef(false);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "AuthContext onAuthStateChange:",
        event,
        session?.user?.id ?? "no user"
      );

      if (!mounted) return;

      if (session?.user) {
        setIsLoading(true);
        setUser(session.user);
        setSession(session);
        const profile = await fetchUserProfile(session.user.id, session.access_token);
        if (mounted) {
          setRole(profile.role);
          setTenantId(profile.tenantId);
          setIsAdmin(profile.isAdmin);
          setLicensedClasses(profile.licensedClasses);
          setDisplayName(profile.displayName ?? null);
          if (profile.tenantId) {
            const logo = await fetchTenantLogo(profile.tenantId, session.access_token);
            if (mounted) setLogoUrl(logo);
          }
        }

        // Log broker login to audit trail (fire-and-forget)
        if (event === "SIGNED_IN" && profile.tenantId) {
          fetch("/api/log-event", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ eventType: "broker.login" }),
          }).catch(() => {/* never let this block */});
        }

        // Navigate to dashboard on explicit sign-in
        if (event === "SIGNED_IN" && shouldNavigateOnSignIn.current) {
          shouldNavigateOnSignIn.current = false;
          navigate("/dashboard");
        }
      } else {
        setUser(null);
        setSession(null);
        setRole(null);
        setTenantId(null);
        setIsAdmin(false);
        setLicensedClasses(["trade_credit"]);
        setDisplayName(null);
        setLogoUrl(null);
      }

      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const signIn = useCallback(async (email: string, password: string) => {
    console.log("signIn: calling signInWithPassword");
    shouldNavigateOnSignIn.current = true;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("signIn: result", { data, error });
    if (error) {
      shouldNavigateOnSignIn.current = false;
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    console.log('signOut: starting');
    supabase.auth.signOut({ scope: 'local' }); // no await
    localStorage.removeItem('sb-formflow-auth');
    setUser(null);
    setSession(null);
    setRole(null);
    setTenantId(null);
    console.log('signOut: redirecting');
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, role, tenantId, logoUrl, isAdmin, licensedClasses, displayName, isLoading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}