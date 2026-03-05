import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CheckCircle2, XCircle, Clock, Shield, Cpu, AlertTriangle,
  Search, Filter, ChevronRight, Users, ArrowRight, Settings,
  Activity, UserPlus, Trash2, Database, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

interface Application {
  id: number;
  userId: number;
  applicationType: string;
  visaType: string;
  destinationCountry: string;
  status: string;
  currentStage: number;
  riskScore: number | null;
  riskLevel: string | null;
  createdAt: string;
}

interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
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

export default function OfficerDashboard() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<"grant" | "deny" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [denialReason, setDenialReason] = useState("");

  const appsQuery = useQuery<Application[]>({ queryKey: ["/api/applications/all"] });
  const usersQuery = useQuery<User[]>({ 
    queryKey: ["/api/admin/users"], 
    enabled: isAdmin 
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role Updated" });
    },
  });

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
  const users = usersQuery.data || [];

  const filtered = apps.filter(a => {
    const matchSearch = !search || a.visaType.includes(search.toLowerCase()) || a.destinationCountry.toLowerCase().includes(search.toLowerCase()) || String(a.id).includes(search);
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

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
            {isAdmin ? "Admin Control Panel" : "Immigration Officer Dashboard"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isAdmin ? "System-wide monitoring and user management" : "Review and process visa applications"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="applications">
        <TabsList className="mb-4">
          <TabsTrigger value="applications" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Applications
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              User Management
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="system" className="gap-2">
              <Activity className="w-4 h-4" />
              System Status
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="applications">
          <div className="space-y-6">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search applications..."
                  className="pl-8"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {["all", "pending", "document_review", "granted", "denied"].map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={filterStatus === s ? "default" : "outline"}
                    onClick={() => setFilterStatus(s)}
                  >
                    {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
                  </Button>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {appsQuery.isLoading ? (
                  <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
                ) : (
                  <div className="divide-y divide-border">
                    {filtered.map(app => {
                      const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                      const nextAction = getNextStageAction(app);
                      const canDecide = app.status !== "granted" && app.status !== "denied";
                      const riskColor = app.riskLevel === "high" ? "text-red-500" : app.riskLevel === "medium" ? "text-yellow-500" : "text-green-500";

                      return (
                        <div key={app.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold">#{app.id}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm capitalize">{app.visaType} Visa</span>
                                <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">Dest: {app.destinationCountry}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {app.riskLevel && (
                              <Badge variant="outline" className={`${riskColor} border-current text-[10px]`}>
                                {app.riskLevel.toUpperCase()} RISK
                              </Badge>
                            )}
                            {nextAction && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8"
                                onClick={() => stageMutation.mutate({ id: app.id, stage: nextAction.stage })}
                              >
                                {nextAction.label}
                              </Button>
                            )}
                            {canDecide && (
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  className="h-8 bg-green-600 hover:bg-green-700"
                                  onClick={() => { setSelectedApp(app); setActionType("grant"); }}
                                >
                                  Grant
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  className="h-8"
                                  onClick={() => { setSelectedApp(app); setActionType("deny"); }}
                                >
                                  Deny
                                </Button>
                              </div>
                            )}
                            <Link href={`/applications/${app.id}`}>
                              <Button size="sm" variant="ghost" className="h-8"><ArrowRight className="w-4 h-4" /></Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle>User Directory</CardTitle>
                  <CardDescription>Manage application and officer accounts</CardDescription>
                </div>
                <Button size="sm" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Add User
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {users.map(u => (
                    <div key={u.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select 
                          defaultValue={u.role} 
                          onValueChange={(role) => roleMutation.mutate({ id: u.id, role })}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="applicant">Applicant</SelectItem>
                            <SelectItem value="officer">Officer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="system">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Database Operations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">PostgreSQL Status</span>
                    </div>
                    <Badge className="bg-green-500">OPTIMIZED</Badge>
                  </div>
                  <Button variant="outline" className="w-full text-xs h-8">Run DB Vacuum</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Activity Log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    "New Officer Sarah Chen added by Admin",
                    "Database backup completed (2.4MB)",
                    "AI Analysis run for Application #42",
                    "System update v2.0.1 applied successfully"
                  ].map((log, i) => (
                    <div key={i} className="flex gap-2 text-[10px] text-muted-foreground">
                      <span className="font-mono text-primary">[SYSTEM]</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

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
                  />
                </div>
              )}
              <div>
                <Label>Internal Processing Notes</Label>
                <Textarea
                  className="mt-1"
                  placeholder="Record observations for the blockchain ledger..."
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                />
              </div>
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
            >
              {decisionMutation.isPending ? "Processing..." : actionType === "grant" ? "Grant Visa" : "Deny Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
