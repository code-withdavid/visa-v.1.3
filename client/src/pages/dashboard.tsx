import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FilePlus, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Shield, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
