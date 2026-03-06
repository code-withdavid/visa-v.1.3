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
  password: z.string().min(4, "Password required"),
});

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "At least 6 characters"),
  nationality: z.string().optional(),
  passportNumber: z.string().optional(),
  phone: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

const FEATURES = [
  { icon: Cpu, label: "AI Document Verification", desc: "Instant OCR & authenticity check" },
  { icon: Shield, label: "Fraud Detection Engine", desc: "Real-time AI risk scoring" },
  { icon: Link2, label: "Blockchain Visa Ledger", desc: "Tamper-proof immutable records" },
  { icon: Globe, label: "Autonomous Renewal", desc: "AI-guided proactive reminders" },
];

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { login, register, user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePortal, setActivePortal] = useState<"applicant" | "officer" | "admin">("applicant");

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", nationality: "", passportNumber: "", phone: "" },
  });

  useEffect(() => {
    if (user) {
      if (user.role === "admin") navigate("/officer"); // Admin shares officer dashboard for now or has custom panel
      else if (user.role === "officer") navigate("/officer");
      else navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleLogin = async (data: LoginForm) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      // Auth context handles redirection via useEffect
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
    } catch (e: any) {
      toast({ title: "Registration Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
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
          <div className="h-1.5 w-1.5 rounded-full bg-green-400 pulse-glow" />
          <span className="text-[11px] font-mono text-sidebar-foreground/40">SECURE • ENCRYPTED • ISO 27001 COMPLIANT</span>
        </div>
      </div>

      {/* Right Panel - Auth */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Globe className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg">VisaFlow</span>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Login Portal</h2>
            <div className="flex justify-center gap-2">
              <Button 
                variant={activePortal === "applicant" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setActivePortal("applicant")}
                className="text-[10px] font-mono uppercase"
              >
                Applicant
              </Button>
              <Button 
                variant={activePortal === "officer" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setActivePortal("officer")}
                className="text-[10px] font-mono uppercase"
              >
                Immigration Officer
              </Button>
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
                      <CardTitle className="capitalize">{activePortal} Access</CardTitle>
                      <CardDescription>Secure login for {activePortal} portal</CardDescription>
                    </div>
                    <UserCircle className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      <FormField control={loginForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Portal Email</FormLabel>
                          <FormControl>
                            <Input placeholder="your@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={loginForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Security Key</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
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
                      <Button className="w-full" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Authenticating..." : `Access ${activePortal} Portal`}
                      </Button>
                    </form>
                  </Form>
                  
                  <div className="mt-4 p-3 rounded-md bg-muted text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Demo Accounts:</p>
                    {activePortal === "applicant" && (
                      <p>Applicant: <span className="font-mono">demo@example.com</span> / <span className="font-mono">demo123</span></p>
                    )}
                    {activePortal === "officer" && (
                      <p>Officer: <span className="font-mono">officer@visaflow.gov</span> / <span className="font-mono">officer123</span></p>
                    )}
                    {activePortal === "admin" && (
                      <p>Admin: <span className="font-mono">admin@visaflow.gov</span> / <span className="font-mono">admin123</span> (Simulated)</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Applicant Registration</CardTitle>
                  <CardDescription>Start your visa application journey</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-3">
                      <FormField control={registerForm.control} name="fullName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={registerForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="your@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={registerForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Min. 6 characters" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={registerForm.control} name="nationality" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nationality</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Nigerian" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={registerForm.control} name="passportNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport No.</FormLabel>
                            <FormControl>
                              <Input placeholder="A12345678" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <Button className="w-full" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Creating account..." : "Register Applicant"}
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
