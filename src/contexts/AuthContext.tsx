import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "OWNER" | "ADMIN" | "STAFF" | "ACCOUNTANT" | "DRIVER" | "SALESMAN";

interface AppUser {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AppRole;
  assigned_shop_id: string | null;
  is_active: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = async (authUserId: string, currentUser?: User) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching app user:", error);
        return;
      }

      if (data) {
        setAppUser(data as unknown as AppUser);
      } else if (currentUser) {
        console.log("App user record not found. Auto-creating public.users entry...");
        const name = currentUser.user_metadata?.full_name || currentUser.email || "New User";
        const email = currentUser.email || "";

        const { data: newData, error: insertError } = await supabase
          .from("users")
          .insert({
            auth_user_id: authUserId,
            name,
            email,
            role: "STAFF"
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error auto-creating app user:", insertError);
        } else if (newData) {
          setAppUser(newData as unknown as AppUser);
        }
      }
    } catch (e) {
      console.error("Failed in fetchAppUser:", e);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchAppUser(session.user.id, session.user), 0);
        } else {
          setAppUser(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAppUser(session.user.id, session.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAppUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, appUser, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
