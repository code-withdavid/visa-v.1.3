import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Globe, Shield, Cpu, Link2, Eye, EyeOff, UserCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  { icon: Cpu, label: "AI Document Verification", desc: "Instant OCR & authenticity check" },
  { icon: Shield, label: "Fraud Detection Engine", desc: "Real-time AI risk scoring" },
  { icon: Link2, label: "Blockchain Visa Ledger", desc: "Tamper-proof immutable records" },
  { icon: Globe, label: "Autonomous Renewal", desc: "AI-guided proactive reminders" },
];

const OFFICER_ACCOUNTS: Record<string, { email: string; password: string; country: string }> = {
  USA: { email: "usa_officer@visa.com", password: "usa123", country: "USA" },
  China: { email: "china_officer@visa.com", password: "china123", country: "China" },
  UK: { email: "uk_officer@visa.com", password: "uk123", country: "UK" },
  Canada: { email: "canada_officer@visa.com", password: "canada123", country: "Canada" },
  Australia: { email: "australia_officer@visa.com", password: "australia123", country: "Australia" },
};

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { login, register, user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePortal, setActivePortal] = useState<Portal>("applicant");

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

  // Auto-fill officer demo credentials
  const fillOfficerCreds = (country: string) => {
    const acc = OFFICER_ACCOUNTS[country];
    if (acc) {
      loginForm.setValue("email", acc.email);
      loginForm.setValue("password", acc.password);
    }
  };

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
      // Reset form and switch to login tab
      registerForm.reset();
      const tabsElement = document.querySelector('[value="login"]') as HTMLElement;
      if (tabsElement) tabsElement.click();
    } catch (e: any) {
      toast({ title: "Registration Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-10 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">VisaFlow</span>
          </div>
          <p className="text-[11px] font-mono text-sidebar-foreground/40 tracking-widest uppercase">Futuristic Edition v2.0</p>
        </div>
        <div className="relative space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-sidebar-foreground leading-tight mb-3">
              Next-Generation<br />Visa Processing
            </h1>
            <p className="text-sidebar-foreground/60 text-sm leading-relaxed">
              Powered by artificial intelligence, secured by blockchain. The future of border control and immigration management is here.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-3 p-3 rounded-md bg-sidebar-accent/50">
                <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-sidebar-foreground">{f.label}</p>
                  <p className="text-xs text-sidebar-foreground/50">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-[11px] font-mono text-sidebar-foreground/40">SECURE · ENCRYPTED · ISO 27001 COMPLIANT</span>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Globe className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">VisaFlow</span>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold mb-3">Select Portal</h2>
            <div className="flex justify-center gap-2 flex-wrap">
              {(["applicant", "officer", "admin"] as Portal[]).map(p => (
                <Button
                  key={p}
                  variant={activePortal === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setActivePortal(p); loginForm.reset(); }}
                  className="text-[10px] font-mono uppercase tracking-wider"
                  data-testid={`button-portal-${p}`}
                >
                  {p === "officer" ? "Immigration Officer" : p}
                </Button>
              ))}
            </div>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
              {activePortal === "applicant" && (
                <TabsTrigger value="register" className="flex-1">Register</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="capitalize">
                        {activePortal === "officer" ? "Immigration Officer" : activePortal} Access
                      </CardTitle>
                      <CardDescription>
                        {activePortal === "officer"
                          ? "Country-specific portal for immigration officers"
                          : activePortal === "admin"
                          ? "System administrator access only"
                          : "Applicant secure login"}
                      </CardDescription>
                    </div>
                    <UserCircle className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      <FormField control={loginForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="your@email.com" data-testid="input-login-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={loginForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                data-testid="input-login-password"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button className="w-full" type="submit" disabled={isSubmitting} data-testid="button-login">
                        {isSubmitting ? "Authenticating..." : `Access ${activePortal === "officer" ? "Officer" : activePortal === "admin" ? "Admin" : "Applicant"} Portal`}
                      </Button>
                    </form>
                  </Form>

                  {/* Demo credentials panel */}
                  <div className="mt-4 p-3 rounded-md bg-muted text-xs text-muted-foreground space-y-1.5">
                    <p className="font-semibold text-foreground">Demo Accounts</p>
                    {activePortal === "applicant" && (
                      <p>
                        <span className="font-mono">demo@example.com</span> /{" "}
                        <span className="font-mono">demo123</span>
                      </p>
                    )}
                    {activePortal === "admin" && (
                      <p>
                        <span className="font-mono">admin@visa.com</span> /{" "}
                        <span className="font-mono">admin123</span>
                      </p>
                    )}
                    {activePortal === "officer" && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground mb-2">Click a country to auto-fill:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.keys(OFFICER_ACCOUNTS).map(country => (
                            <button
                              key={country}
                              type="button"
                              onClick={() => fillOfficerCreds(country)}
                              className="px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 font-mono text-[10px] transition-colors"
                            >
                              {country}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Create Applicant Account</CardTitle>
                  <CardDescription>
                    Fill in the details below to register
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-3">
                      <FormField control={registerForm.control} name="fullName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" data-testid="input-register-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={registerForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="your@email.com" data-testid="input-register-email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={registerForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Min. 6 characters"
                                data-testid="input-register-password"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={registerForm.control} name="confirmPassword" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm your password"
                                data-testid="input-register-confirm-password"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <Button className="w-full" type="submit" disabled={isSubmitting} data-testid="button-register">
                        {isSubmitting ? "Creating account..." : "Register"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
