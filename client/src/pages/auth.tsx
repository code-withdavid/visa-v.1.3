import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Globe, Zap, Shield, Globe2, Eye, EyeOff, ArrowRight, Plane } from "lucide-react";
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "At least 6 characters"),
  confirmPassword: z.string().min(6, "At least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

type Portal = "applicant" | "officer" | "admin";

const FEATURES = [
  { icon: Zap, label: "Instant Eligibility", desc: "No guesswork." },
  { icon: Shield, label: "AI Document Check", desc: "Zero errors." },
  { icon: Globe2, label: "24/7 Global Support", desc: "Our experts are always available." },
];

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { login, register, user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePortal, setActivePortal] = useState<Portal>("admin");
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (user) {
      if (user.role === "admin") navigate("/officer");
      else if (user.role === "officer") navigate("/officer");
      else navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleLogin = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
    } catch (e: any) {
      toast({ title: "Login Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    setIsSubmitting(true);
    try {
      await register(data);
      toast({ title: "Registration Successful", description: "Registration successful. Please log in." });
      registerForm.reset();
      setActiveTab("login");
    } catch (e: any) {
      toast({ title: "Registration Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const portalButtonLabel = activePortal === "officer"
    ? "Officer"
    : activePortal === "admin"
    ? "Admin"
    : "Applicant";

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{
        background: "linear-gradient(135deg, #0b1d3a 0%, #0d2257 40%, #1a3a8f 100%)",
      }}
    >
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 relative z-10">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-white" />
          <span className="text-white font-bold text-lg tracking-tight">VisaFlow</span>
          <span className="text-blue-300/60 text-xs ml-1 font-mono">v2.0</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#" className="text-blue-100/70 text-sm hover:text-white transition-colors">Check Eligibility</a>
          <a href="#" className="text-blue-100/70 text-sm hover:text-white transition-colors">My Application</a>
          <a href="#" className="text-blue-100/70 text-sm hover:text-white transition-colors">Support</a>
        </div>
        <button className="border border-white/30 text-white text-sm px-4 py-1.5 rounded-full hover:bg-white/10 transition-colors">
          Get Help
        </button>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex items-center px-8 py-8 gap-8 relative">
        {/* Background glow */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />

        {/* Left — Hero */}
        <div className="flex-1 max-w-lg relative z-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-xs font-mono tracking-widest text-blue-200/70 border border-blue-400/30 rounded-full px-3 py-1">
              SECURE. ACCURATE. GLOBAL.
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-300/50" />
          </div>

          <h1 className="text-5xl font-extrabold text-white leading-tight mb-4">
            Your Journey<br />
            <span style={{ color: "#f59e0b" }}>Starts Online</span>
            <span className="text-white">.</span>
          </h1>

          <p className="text-blue-100/60 text-sm leading-relaxed mb-8 max-w-sm">
            Skip the embassy. Our next-generation platform leverages AI to process visas for 190+ countries with near-instant eligibility checking.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.slice(0, 2).map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(59,130,246,0.25)" }}>
                  <f.icon className="w-4 h-4 text-blue-300" />
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{f.label}</p>
                  <p className="text-blue-200/50 text-[11px]">{f.desc}</p>
                </div>
              </div>
            ))}
            <div
              className="col-span-2 flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(59,130,246,0.25)" }}>
                <Globe2 className="w-4 h-4 text-blue-300" />
              </div>
              <div>
                <p className="text-white text-xs font-semibold">{FEATURES[2].label}</p>
                <p className="text-blue-200/50 text-[11px]">{FEATURES[2].desc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Center floating card */}
        <div className="hidden xl:flex items-center justify-center relative z-10">
          <div
            className="w-36 h-36 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-2xl"
            style={{ background: "rgba(255,255,255,0.95)" }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #dbeafe, #bfdbfe)" }}>
              <Plane className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-[9px] font-bold tracking-widest text-blue-900/70 text-center leading-tight">
              PREPARE TO<br />TRAVEL
            </p>
          </div>
        </div>

        {/* Right — Login Card */}
        <div className="relative z-10 w-full max-w-sm">
          <div
            className="rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            <div className="px-7 pt-7 pb-6">
              <h2 className="text-xl font-bold text-gray-900 text-center mb-5">Access Portal</h2>

              {/* Portal tabs */}
              <div className="flex gap-1.5 mb-6 p-1 rounded-lg" style={{ background: "#f1f5f9" }}>
                {(["applicant", "officer", "admin"] as Portal[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setActivePortal(p);
                      loginForm.reset();
                      if (p !== "applicant") setActiveTab("login");
                    }}
                    className="flex-1 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all"
                    style={
                      activePortal === p
                        ? { background: "#2563eb", color: "#fff" }
                        : { background: "transparent", color: "#64748b" }
                    }
                    data-testid={`button-portal-${p}`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Login / Register toggle — only for applicant */}
              {activePortal === "applicant" && (
                <div className="flex gap-2 mb-5">
                  <button
                    onClick={() => setActiveTab("login")}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={
                      activeTab === "login"
                        ? { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }
                        : { background: "transparent", color: "#94a3b8", border: "1px solid transparent" }
                    }
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => setActiveTab("register")}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={
                      activeTab === "register"
                        ? { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }
                        : { background: "transparent", color: "#94a3b8", border: "1px solid transparent" }
                    }
                  >
                    Register
                  </button>
                </div>
              )}

              {/* Login Form */}
              {activeTab === "login" && (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField control={loginForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block mb-1">
                          Secure Email
                        </label>
                        <FormControl>
                          <input
                            placeholder="name@travel.com"
                            data-testid="input-login-email"
                            className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 outline-none transition-all"
                            style={{
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                            }}
                            onFocus={e => (e.target.style.borderColor = "#3b82f6")}
                            onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )} />
                    <FormField control={loginForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block mb-1">
                          Encrypted Password
                        </label>
                        <FormControl>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              data-testid="input-login-password"
                              className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 outline-none transition-all pr-10"
                              style={{
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                              }}
                              onFocus={e => (e.target.style.borderColor = "#3b82f6")}
                              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )} />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60 mt-1"
                      style={{ background: "linear-gradient(90deg, #2563eb, #1d4ed8)" }}
                      data-testid="button-login"
                    >
                      {isSubmitting ? "Authenticating..." : `Access ${portalButtonLabel} Portal`}
                    </button>
                  </form>
                </Form>
              )}

              {/* Register Form — applicant only */}
              {activeTab === "register" && activePortal === "applicant" && (
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-3">
                    <FormField control={registerForm.control} name="fullName" render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block mb-1">
                          Full Name
                        </label>
                        <FormControl>
                          <input
                            placeholder="John Doe"
                            data-testid="input-register-name"
                            className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 outline-none transition-all"
                            style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                            onFocus={e => (e.target.style.borderColor = "#3b82f6")}
                            onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )} />
                    <FormField control={registerForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block mb-1">
                          Secure Email
                        </label>
                        <FormControl>
                          <input
                            placeholder="your@email.com"
                            data-testid="input-register-email"
                            className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 outline-none transition-all"
                            style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                            onFocus={e => (e.target.style.borderColor = "#3b82f6")}
                            onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )} />
                    <FormField control={registerForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block mb-1">
                          Password
                        </label>
                        <FormControl>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder="Min. 6 characters"
                              data-testid="input-register-password"
                              className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 outline-none transition-all pr-10"
                              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                              onFocus={e => (e.target.style.borderColor = "#3b82f6")}
                              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                              {...field}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )} />
                    <FormField control={registerForm.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block mb-1">
                          Confirm Password
                        </label>
                        <FormControl>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm password"
                              data-testid="input-register-confirm-password"
                              className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-800 outline-none transition-all pr-10"
                              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                              onFocus={e => (e.target.style.borderColor = "#3b82f6")}
                              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                              {...field}
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )} />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-60 mt-1"
                      style={{ background: "linear-gradient(90deg, #2563eb, #1d4ed8)" }}
                      data-testid="button-register"
                    >
                      {isSubmitting ? "Creating account..." : "Create Account"}
                    </button>
                  </form>
                </Form>
              )}
            </div>

            {/* Card footer */}
            <div
              className="flex items-center justify-around py-3 px-7"
              style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}
            >
              {["+ GLOBAL", "+ ENCRYPTED", "+ VERIFIED"].map((label) => (
                <span key={label} className="text-[9px] font-bold tracking-widest text-gray-400">{label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
