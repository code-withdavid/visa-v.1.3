import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  emailVerified?: boolean;
  assignedCountry?: string;
  nationality?: string;
  passportNumber?: string;
  dateOfBirth?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ requiresVerification?: boolean; email?: string }>;
  register: (data: RegisterData) => Promise<{ requiresVerification?: boolean; email?: string }>;
  logout: () => void;
  setSession: (user: User, token: string) => void;
  isLoading: boolean;
}

interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  nationality?: string;
  passportNumber?: string;
  dateOfBirth?: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("visa_token");
    if (savedToken) {
      setToken(savedToken);
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(u => {
          if (u) setUser(u);
          else { localStorage.removeItem("visa_token"); setToken(null); }
        })
        .catch(() => { localStorage.removeItem("visa_token"); setToken(null); })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.requiresVerification) {
        return { requiresVerification: true, email: data.email || email };
      }
      throw new Error(data.message || "Login failed");
    }
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("visa_token", data.token);
    return {};
  };

  const register = async (formData: RegisterData) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Registration failed");
    }
    if (data.requiresVerification) {
      return { requiresVerification: true, email: formData.email, devOtp: data.devOtp as string | undefined };
    }
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("visa_token", data.token);
    return {};
  };

  const setSession = (newUser: User, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem("visa_token", newToken);
  };

  const logout = () => {
    const t = token;
    setUser(null);
    setToken(null);
    localStorage.removeItem("visa_token");
    if (t) fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${t}` } });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, setSession, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
