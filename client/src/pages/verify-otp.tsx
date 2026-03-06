import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Globe, Mail, ShieldCheck, RefreshCw, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface VerifyOTPProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function VerifyOTPForm({ email, onSuccess, onBack }: VerifyOTPProps) {
  const { toast } = useToast();
  const { setSession } = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length < 6) {
      toast({ title: "Incomplete OTP", description: "Please enter all 6 digits.", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpString }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");

      setVerified(true);
      setSession(data.user, data.token);
      toast({ title: "Email Verified!", description: "Your account is now active." });
      setTimeout(onSuccess, 1500);
    } catch (e: any) {
      toast({ title: "Verification Failed", description: e.message, variant: "destructive" });
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      toast({ title: "OTP Resent", description: "Check your email for the new code." });
    } catch (e: any) {
      toast({ title: "Failed to resend", description: e.message, variant: "destructive" });
    } finally {
      setIsResending(false);
    }
  };

  if (verified) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-green-500">Email Verified!</h2>
        <p className="text-muted-foreground text-sm">Redirecting to your dashboard...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Email Verification
        </CardTitle>
        <CardDescription>
          We sent a 6-digit OTP to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3 p-3 rounded-md bg-primary/10 border border-primary/20">
          <Mail className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Check your inbox and spam folder. The OTP expires in{" "}
            <span className="text-yellow-500 font-medium">5 minutes</span>.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium mb-3 text-center">Enter your 6-digit OTP</p>
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <Input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                value={digit}
                onChange={e => handleInput(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                maxLength={1}
                className="w-12 h-14 text-center text-2xl font-mono font-bold border-2 focus:border-primary"
                data-testid={`input-otp-${i}`}
                inputMode="numeric"
              />
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleVerify}
          disabled={isVerifying || otp.join("").length < 6}
          data-testid="button-verify-otp"
        >
          {isVerifying ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verifying...
            </span>
          ) : (
            "Verify Email"
          )}
        </Button>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground gap-1">
            <ArrowLeft className="w-3 h-3" />
            Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
            className="gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isResending ? "animate-spin" : ""}`} />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyOTPPage() {
  const [, navigate] = useLocation();
  const email = new URLSearchParams(window.location.search).get("email") || "";

  if (!email) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <Globe className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg">VisaFlow</span>
        </div>
        <VerifyOTPForm
          email={email}
          onSuccess={() => navigate("/dashboard")}
          onBack={() => navigate("/auth")}
        />
      </div>
    </div>
  );
}
