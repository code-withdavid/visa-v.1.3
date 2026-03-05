import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CheckCircle2, XCircle, Clock, Shield, Cpu, AlertTriangle,
  Search, Filter, ChevronRight, Users, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Application {
  id: number;
  userId: number;
  applicationType: string;
  visaType: string;
  destinationCountry: string;
  purposeOfVisit: string;
  status: string;
  currentStage: number;
  riskScore: number | null;
  riskLevel: string | null;
  aiAnalysisSummary: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; dot: string }> = {
  pending: { label: "Pending", variant: "secondary", dot: "bg-yellow-500" },
  document_review: { label: "Doc Review", variant: "secondary", dot: "bg-blue-500" },
  security_check: { label: "Security Check", variant: "secondary", dot: "bg-purple-500" },
  risk_assessment: { label: "Risk Assessment", variant: "secondary", dot: "bg-orange-500" },
  blockchain_entry: { label: "Blockchain", variant: "default", dot: "bg-cyan-500" },
  granted: { label: "Granted", variant: "default", dot: "bg-green-500" },
  denied: { label: "Denied", variant: "destructive", dot: "bg-red-500" },
};

const STAGES = [
  { stage: 1, label: "Complete Doc Review" },
  { stage: 2, label: "Complete Security Check" },
  { stage: 3, label: "Complete Background Verify" },
  { stage: 4, label: "Complete Risk Assessment" },
];

export default function OfficerDashboard() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<"grant" | "deny" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [denialReason, setDenialReason] = useState("");

  const appsQuery = useQuery<Application[]>({ queryKey: ["/api/applications/all"] });

  const riskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/applications/${id}/risk-score`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/all"] });
      toast({ title: "Risk Analysis Complete" });
    },
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: number }) => {
      const res = await apiRequest("POST", `/api/officer/applications/${id}/stage`, { stage, notes: "Stage completed by officer" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/all"] });
      toast({ title: "Stage Advanced" });
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ id, action, notes, reason }: { id: number; action: "grant" | "deny"; notes: string; reason?: string }) => {
      const path = action === "grant" ? `/api/officer/applications/${id}/grant` : `/api/officer/applications/${id}/deny`;
      const res = await apiRequest("POST", path, { notes, reason });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      toast({ title: vars.action === "grant" ? "Visa Granted!" : "Application Denied", description: "Decision recorded on blockchain." });
      setSelectedApp(null);
      setActionType(null);
      setActionNote("");
      setDenialReason("");
    },
    onError: () => toast({ title: "Error", description: "Decision failed.", variant: "destructive" }),
  });

  const apps = appsQuery.data || [];

  const filtered = apps.filter(a => {
    const matchSearch = !search || a.visaType.includes(search.toLowerCase()) || a.destinationCountry.toLowerCase().includes(search.toLowerCase()) || String(a.id).includes(search);
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusCounts = apps.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getNextStageAction = (app: Application) => {
    if (app.status === "pending" && app.currentStage === 1) return { stage: 1, label: "Start Doc Review" };
    if (app.status === "document_review" && app.currentStage === 2) return { stage: 2, label: "Approve Security Check" };
    if (app.status === "security_check" && app.currentStage === 3) return { stage: 3, label: "Verify Background" };
    if (app.status === "risk_assessment" && app.currentStage === 4) return { stage: 4, label: "Record Risk" };
    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Officer Control Center
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Review and process visa applications</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: apps.length, color: "text-foreground" },
          { label: "Pending", value: (statusCounts.pending || 0) + (statusCounts.document_review || 0), color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Granted", value: statusCounts.granted || 0, color: "text-green-600 dark:text-green-400" },
          { label: "High Risk", value: apps.filter(a => a.riskLevel === "high").length, color: "text-red-600 dark:text-red-400" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, visa type, country..."
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "document_review", "security_check", "granted", "denied"].map(s => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? "default" : "outline"}
              onClick={() => setFilterStatus(s)}
              data-testid={`filter-${s}`}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
              {s !== "all" && statusCounts[s] ? ` (${statusCounts[s]})` : ""}
            </Button>
          ))}
        </div>
      </div>

      {/* Applications Table */}
      <Card>
        <CardContent className="p-0">
          {appsQuery.isLoading ? (
            <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No applications found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(app => {
                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                const nextAction = getNextStageAction(app);
                const canDecide = app.status !== "granted" && app.status !== "denied";
                const riskColor = app.riskLevel === "high" ? "text-red-500" : app.riskLevel === "medium" ? "text-yellow-500" : "text-green-500";

                return (
                  <div key={app.id} className="p-4" data-testid={`officer-app-${app.id}`}>
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold font-mono">#{app.id}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm capitalize">{app.visaType} Visa</span>
                            <span className="text-muted-foreground text-xs">→ {app.destinationCountry}</span>
                            <div className="flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                              <span className="text-xs text-muted-foreground">{cfg.label}</span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{app.purposeOfVisit}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {app.riskLevel && (
                              <span className={`text-xs font-medium capitalize ${riskColor}`}>
                                {app.riskLevel} risk ({Math.round(app.riskScore || 0)})
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(app.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {!app.riskLevel && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => riskMutation.mutate(app.id)}
                            disabled={riskMutation.isPending}
                            data-testid={`button-risk-${app.id}`}
                          >
                            <Cpu className="w-3 h-3 mr-1" />
                            Risk AI
                          </Button>
                        )}
                        {nextAction && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => stageMutation.mutate({ id: app.id, stage: nextAction.stage })}
                            disabled={stageMutation.isPending}
                            data-testid={`button-advance-${app.id}`}
                          >
                            <ChevronRight className="w-3 h-3 mr-1" />
                            {nextAction.label}
                          </Button>
                        )}
                        {canDecide && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => { setSelectedApp(app); setActionType("grant"); }}
                              data-testid={`button-grant-${app.id}`}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Grant
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => { setSelectedApp(app); setActionType("deny"); }}
                              data-testid={`button-deny-${app.id}`}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Deny
                            </Button>
                          </>
                        )}
                        <Link href={`/applications/${app.id}`}>
                          <Button size="sm" variant="ghost" data-testid={`button-view-${app.id}`}>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Dialog */}
      <Dialog open={!!selectedApp && !!actionType} onOpenChange={() => { setSelectedApp(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={actionType === "grant" ? "text-green-600" : "text-destructive"}>
              {actionType === "grant" ? "Grant Visa" : "Deny Application"}
            </DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted text-sm">
                <p className="font-medium capitalize">{selectedApp.visaType} Visa — {selectedApp.destinationCountry}</p>
                <p className="text-muted-foreground text-xs">Application #{selectedApp.id}</p>
              </div>
              {actionType === "deny" && (
                <div>
                  <Label>Denial Reason</Label>
                  <Textarea
                    className="mt-1"
                    placeholder="Enter the reason for denial..."
                    value={denialReason}
                    onChange={e => setDenialReason(e.target.value)}
                    data-testid="textarea-denial-reason"
                  />
                </div>
              )}
              <div>
                <Label>Officer Notes (Optional)</Label>
                <Textarea
                  className="mt-1"
                  placeholder="Internal notes..."
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  data-testid="textarea-officer-notes"
                />
              </div>
              {actionType === "grant" && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-cyan-50 dark:bg-cyan-900/20 text-xs text-cyan-700 dark:text-cyan-400">
                  <Shield className="w-4 h-4 flex-shrink-0" />
                  Granting will automatically create a blockchain record and issue a visa number.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedApp(null); setActionType(null); }}>Cancel</Button>
            <Button
              variant={actionType === "grant" ? "default" : "destructive"}
              onClick={() => {
                if (!selectedApp || !actionType) return;
                decisionMutation.mutate({ id: selectedApp.id, action: actionType, notes: actionNote, reason: denialReason });
              }}
              disabled={decisionMutation.isPending}
              data-testid="button-confirm-decision"
            >
              {decisionMutation.isPending ? "Processing..." : actionType === "grant" ? "Confirm Grant" : "Confirm Denial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
