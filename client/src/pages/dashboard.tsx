import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  FilePlus, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowRight,
  Shield, Cpu, Upload, FileText, ImageIcon, Banknote, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

interface Application {
  id: number;
  applicationType: string;
  visaType: string;
  destinationCountry: string;
  status: string;
  currentStage: number;
  riskLevel: string | null;
  riskScore: number | null;
  createdAt: string;
  expiryDate: string | null;
}

interface Document {
  id: number;
  applicationId: number;
  documentType: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  verified: boolean;
  aiConfidenceScore: number | null;
  aiVerificationNotes: string | null;
  uploadedAt: string;
}

interface Stats {
  total: number;
  pending: number;
  granted: number;
  denied: number;
  inReview?: number;
  blockchainEntries?: number;
  highRisk?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  document_review: { label: "Document Review", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  security_check: { label: "Security Check", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  risk_assessment: { label: "Risk Assessment", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  blockchain_entry: { label: "Blockchain Entry", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-900/30" },
  granted: { label: "Granted", color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  denied: { label: "Denied", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  renewal_due: { label: "Renewal Due", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
};

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low Risk", color: "text-green-600 dark:text-green-400" },
  medium: { label: "Medium Risk", color: "text-yellow-600 dark:text-yellow-400" },
  high: { label: "High Risk", color: "text-red-600 dark:text-red-400" },
};

const DOC_SLOTS = [
  { id: "passport", label: "Passport", desc: "Biodata page (PDF/Image)", icon: FileText },
  { id: "photo", label: "Photo", desc: "Passport-size photo (Image)", icon: ImageIcon },
  { id: "financial", label: "Financial Proof", desc: "Bank statements (PDF/Image)", icon: Banknote },
];

function DocumentUploadSection({ applications }: { applications: Application[] }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const latestApp = applications[0] ?? null;

  const docsQuery = useQuery<Document[]>({
    queryKey: ["/api/user/documents"],
    enabled: !!latestApp,
  });

  const docs = docsQuery.data ?? [];

  const uploadMutation = useMutation({
    mutationFn: async ({ applicationId, type, file }: { applicationId: number; type: string; file: File }) => {
      const res = await apiRequest("POST", `/api/applications/${applicationId}/documents`, {
        documentType: type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/documents"] });
      toast({ title: "Document Uploaded", description: "Your document has been saved successfully." });
    },
    onError: () => {
      toast({ title: "Upload Failed", description: "Could not upload the document.", variant: "destructive" });
    },
  });

  const handleFileChange = async (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !latestApp) return;
    e.target.value = "";

    setUploading(type);
    try {
      await uploadMutation.mutateAsync({ applicationId: latestApp.id, type, file });
    } finally {
      setUploading(null);
    }
  };

  if (!latestApp) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Document Upload
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
            <FileText className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Create an application first to upload documents.</p>
            <Link href="/applications/new">
              <Button size="sm" variant="outline" className="gap-2">
                <FilePlus className="w-4 h-4" />
                New Application
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Document Upload
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            Application #{latestApp.id} · {latestApp.visaType} → {latestApp.destinationCountry}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DOC_SLOTS.map((slot) => {
            const uploaded = docs.find(d => d.documentType === slot.id && d.applicationId === latestApp.id);
            const isUploading = uploading === slot.id;
            const Icon = slot.icon;

            return (
              <div
                key={slot.id}
                className="relative flex flex-col items-center text-center p-5 rounded-xl border-2 border-dashed border-muted bg-muted/20 hover:border-primary/40 hover:bg-muted/40 transition-all"
                data-testid={`doc-slot-${slot.id}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${uploaded ? "bg-green-500/10" : "bg-primary/10"}`}>
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : (
                    <Icon className={`w-5 h-5 ${uploaded ? "text-green-600 dark:text-green-400" : "text-primary"}`} />
                  )}
                </div>

                <p className="text-sm font-semibold mb-0.5">{slot.label}</p>
                <p className="text-[11px] text-muted-foreground mb-3 leading-tight">{slot.desc}</p>

                {uploaded ? (
                  <div className="w-full space-y-1.5">
                    <Badge
                      variant="outline"
                      className="w-full justify-center gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[11px]"
                      data-testid={`status-uploaded-${slot.id}`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Uploaded
                    </Badge>
                    <p className="text-[10px] text-muted-foreground truncate px-1" title={uploaded.fileName}>
                      {uploaded.fileName}
                    </p>
                    {uploaded.verified ? (
                      <Badge className="w-full justify-center text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" variant="outline">
                        AI Verified {uploaded.aiConfidenceScore ? `· ${Math.round(uploaded.aiConfidenceScore * 100)}%` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="w-full justify-center text-[10px] opacity-70">
                        Pending AI Review
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="w-full">
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/*"
                        disabled={isUploading}
                        ref={el => { fileInputRefs.current[slot.id] = el; }}
                        onChange={e => handleFileChange(slot.id, e)}
                        data-testid={`input-file-${slot.id}`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-[11px] gap-1.5 pointer-events-none"
                        disabled={isUploading}
                        asChild
                      >
                        <span>
                          <Upload className="w-3.5 h-3.5" />
                          {isUploading ? "Uploading..." : "Choose File"}
                        </span>
                      </Button>
                    </label>
                    <Badge
                      variant="secondary"
                      className="mt-2 w-full justify-center text-[10px] opacity-50"
                      data-testid={`status-pending-${slot.id}`}
                    >
                      Pending
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          Accepted formats: PDF, JPG, PNG, WEBP · Max file size: 10 MB
        </p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isOfficer = user?.role === "officer" || user?.role === "admin";

  const applicationsQuery = useQuery<Application[]>({
    queryKey: ["/api/applications"],
    enabled: !isOfficer,
  });

  const allApplicationsQuery = useQuery<Application[]>({
    queryKey: ["/api/applications/all"],
    enabled: isOfficer,
  });

  const statsQuery = useQuery<Stats>({ queryKey: ["/api/stats/overview"] });

  const applications = isOfficer ? allApplicationsQuery.data : applicationsQuery.data;
  const isLoading = isOfficer ? allApplicationsQuery.isLoading : applicationsQuery.isLoading;

  const stats = statsQuery.data;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isOfficer ? "Officer Control Center" : `Welcome back, ${user?.fullName?.split(" ")[0]}`}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isOfficer ? "Manage and process visa applications" : "Track and manage your visa applications"}
          </p>
        </div>
        {!isOfficer && (
          <Link href="/applications/new">
            <Button data-testid="button-new-application" className="gap-2">
              <FilePlus className="w-4 h-4" />
              New Application
            </Button>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Applications", value: stats?.total, icon: FilePlus, color: "text-primary" },
          { label: "Pending Review", value: stats?.pending, icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Visa Granted", value: stats?.granted, icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
          { label: "Denied", value: stats?.denied, icon: XCircle, color: "text-red-600 dark:text-red-400" },
        ].map(s => (
          <Card key={s.label} data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              {statsQuery.isLoading ? (
                <Skeleton className="h-8 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{s.value ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isOfficer && stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.blockchainEntries ?? 0}</p>
                <p className="text-xs text-muted-foreground">Blockchain Records</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.highRisk ?? 0}</p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.inReview ?? 0}</p>
                <p className="text-xs text-muted-foreground">In Review</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Document Upload — applicants only */}
      {!isOfficer && (
        <DocumentUploadSection applications={applications ?? []} />
      )}

      {/* Applications List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isOfficer ? "All Applications" : "My Applications"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !applications?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FilePlus className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">No applications yet</p>
              {!isOfficer && (
                <Link href="/applications/new">
                  <Button variant="link" className="mt-2 text-primary">Start your first application</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {applications.map(app => {
                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                const risk = app.riskLevel ? RISK_CONFIG[app.riskLevel] : null;
                return (
                  <Link key={app.id} href={`/applications/${app.id}`}>
                    <div
                      className="flex items-center justify-between p-4 hover-elevate cursor-pointer"
                      data-testid={`application-row-${app.id}`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-muted-foreground">#{app.id}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm capitalize">{app.visaType} Visa</span>
                            <span className="text-xs text-muted-foreground">→</span>
                            <span className="text-sm text-muted-foreground">{app.destinationCountry}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {risk && (
                              <span className={`text-xs ${risk.color}`}>{risk.label}</span>
                            )}
                            {app.riskScore !== null && (
                              <span className="text-xs text-muted-foreground font-mono">Score: {Math.round(app.riskScore)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Stage {app.currentStage}/6</p>
                          {app.expiryDate && (
                            <p className="text-xs text-muted-foreground">Exp: {app.expiryDate}</p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
