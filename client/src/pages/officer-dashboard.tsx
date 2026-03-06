import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Shield, Search, Users, ArrowRight, Activity,
  UserPlus, Trash2, Database, BarChart3, Globe,
  CheckCircle2, XCircle, Clock, AlertTriangle, MessageSquarePlus,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

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
  createdAt: string;
}

interface UserRecord {
  id: number;
  fullName: string;
  email: string;
  role: string;
  assignedCountry: string | null;
  emailVerified: boolean;
  createdAt: string;
}

interface FeedbackRecord {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  message: string;
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  granted: number;
  denied: number;
  inReview: number;
  blockchainEntries: number;
  highRisk: number;
}

const STATUS_CONF: Record<string, { label: string; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", color: "bg-yellow-500", variant: "secondary" },
  document_review: { label: "Doc Review", color: "bg-blue-500", variant: "secondary" },
  security_check: { label: "Security Check", color: "bg-purple-500", variant: "secondary" },
  risk_assessment: { label: "Risk Assessment", color: "bg-orange-500", variant: "secondary" },
  blockchain_entry: { label: "Blockchain", color: "bg-cyan-500", variant: "default" },
  granted: { label: "Granted", color: "bg-green-500", variant: "default" },
  denied: { label: "Denied", color: "bg-red-500", variant: "destructive" },
};

const COUNTRIES = ["USA", "China", "UK", "Canada", "Australia", "India"];

export default function OfficerDashboard() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<"grant" | "deny" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [createOfficerOpen, setCreateOfficerOpen] = useState(false);
  const [newOfficer, setNewOfficer] = useState({ fullName: "", email: "", password: "", country: "" });

  const appsQuery = useQuery<Application[]>({ queryKey: ["/api/applications/all"] });
  const usersQuery = useQuery<UserRecord[]>({ queryKey: ["/api/admin/users"], enabled: isAdmin });
  const statsQuery = useQuery<Stats>({ queryKey: ["/api/stats/overview"] });
  const feedbackQuery = useQuery<FeedbackRecord[]>({ queryKey: ["/api/feedback"], enabled: isAdmin });

  const decisionMutation = useMutation({
    mutationFn: async ({ id, action, notes, reason }: { id: number; action: "grant" | "deny"; notes: string; reason?: string }) => {
      const path = action === "grant" ? `/api/officer/applications/${id}/grant` : `/api/officer/applications/${id}/deny`;
      return (await apiRequest("POST", path, { notes, reason })).json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      toast({ title: vars.action === "grant" ? "Visa Granted!" : "Application Denied" });
      setSelectedApp(null); setActionType(null); setActionNote(""); setDenialReason("");
    },
    onError: () => toast({ title: "Error", description: "Decision failed.", variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) =>
      (await apiRequest("POST", `/api/admin/users/${id}/role`, { role })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role Updated" });
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/admin/applications/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/overview"] });
      toast({ title: "Application Deleted" });
    },
    onError: () => toast({ title: "Delete Failed", variant: "destructive" }),
  });

  const assignCountryMutation = useMutation({
    mutationFn: async ({ id, country }: { id: number; country: string }) =>
      (await apiRequest("POST", `/api/admin/users/${id}/assign-country`, { country })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Country Assigned" });
    },
  });

  const createOfficerMutation = useMutation({
    mutationFn: async (data: typeof newOfficer) => {
      const res = await apiRequest("POST", "/api/admin/officers", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create officer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Officer Created", description: `${newOfficer.fullName} has been added as an immigration officer.` });
      setCreateOfficerOpen(false);
      setNewOfficer({ fullName: "", email: "", password: "", country: "" });
    },
    onError: (e: any) => {
      toast({ title: "Creation Failed", description: e.message, variant: "destructive" });
    },
  });

  const apps = appsQuery.data || [];
  const allUsers = usersQuery.data || [];
  const stats = statsQuery.data;

  const filtered = apps.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.visaType.includes(q) || a.destinationCountry.toLowerCase().includes(q) || String(a.id).includes(q);
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchCountry = filterCountry === "all" || a.destinationCountry === filterCountry;
    return matchSearch && matchStatus && matchCountry;
  });

  const applicants = allUsers.filter(u => u.role === "applicant");
  const officers = allUsers.filter(u => u.role === "officer");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          {isAdmin ? "Admin Control Panel" : `${currentUser?.assignedCountry || ""} Immigration Officer Dashboard`}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {isAdmin
            ? "System-wide monitoring, user management, and application control"
            : `Viewing visa applications for ${currentUser?.assignedCountry || "your assigned country"}`}
        </p>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Globe, color: "text-blue-500" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-500" },
            { label: "Granted", value: stats.granted, icon: CheckCircle2, color: "text-green-500" },
            { label: "Denied", value: stats.denied, icon: XCircle, color: "text-red-500" },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
                <s.icon className={`w-6 h-6 ${s.color}`} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="applications">
        <TabsList className="mb-4">
          <TabsTrigger value="applications" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Applications
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="officers" className="gap-2">
              <Shield className="w-4 h-4" />
              Officers
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Applicants
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="system" className="gap-2">
              <Activity className="w-4 h-4" />
              System
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="feedback" className="gap-2" data-testid="tab-feedback">
              <MessageSquarePlus className="w-4 h-4" />
              Feedback
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Applications Tab ── */}
        <TabsContent value="applications">
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by visa type, country, ID…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {isAdmin && (
                <Select value={filterCountry} onValueChange={setFilterCountry}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {["all", "pending", "granted", "denied"].map(s => (
                  <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)} className="capitalize">
                    {s === "all" ? "All" : STATUS_CONF[s]?.label || s}
                  </Button>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {appsQuery.isLoading ? (
                  <div className="p-4 space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}</div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No applications found</div>
                ) : (
                  <div className="divide-y divide-border">
                    {filtered.map(app => {
                      const cfg = STATUS_CONF[app.status] || STATUS_CONF.pending;
                      const canDecide = app.status !== "granted" && app.status !== "denied";
                      const riskColor = app.riskLevel === "high" ? "text-red-500" : app.riskLevel === "medium" ? "text-yellow-500" : "text-green-500";

                      return (
                        <div key={app.id} className="p-4 flex items-center gap-3 flex-wrap">
                          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold font-mono">#{app.id}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm capitalize">{app.visaType} Visa</span>
                              <Badge variant={cfg.variant} className="text-[10px] h-5">{cfg.label}</Badge>
                              {app.riskLevel && (
                                <span className={`text-[10px] font-mono font-bold ${riskColor}`}>
                                  {app.riskLevel.toUpperCase()} RISK
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {app.destinationCountry} · {new Date(app.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Delete application #${app.id}? This cannot be undone.`)) {
                                    deleteAppMutation.mutate(app.id);
                                  }
                                }}
                                disabled={deleteAppMutation.isPending}
                                data-testid={`button-delete-app-${app.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canDecide && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-8 bg-green-600 hover:bg-green-700 text-white text-xs"
                                  onClick={() => { setSelectedApp(app); setActionType("grant"); }}
                                  data-testid={`button-grant-${app.id}`}
                                >
                                  Grant
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 text-xs"
                                  onClick={() => { setSelectedApp(app); setActionType("deny"); }}
                                  data-testid={`button-deny-${app.id}`}
                                >
                                  Deny
                                </Button>
                              </>
                            )}
                            <Link href={`/applications/${app.id}`}>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <ArrowRight className="w-4 h-4" />
                              </Button>
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

        {/* ── Officers Tab (Admin only) ── */}
        {isAdmin && (
          <TabsContent value="officers">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Immigration Officers</CardTitle>
                    <CardDescription>Assign officers to countries and manage their access</CardDescription>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setCreateOfficerOpen(true)}
                    data-testid="button-create-officer"
                  >
                    <UserPlus className="w-4 h-4" />
                    New Officer
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {usersQuery.isLoading ? (
                  <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
                ) : officers.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No officers found</div>
                ) : (
                  <div className="divide-y divide-border">
                    {officers.map(u => (
                      <div key={u.id} className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{u.fullName}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Select
                            value={u.assignedCountry || ""}
                            onValueChange={country => assignCountryMutation.mutate({ id: u.id, country })}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs" data-testid={`select-country-${u.id}`}>
                              <SelectValue placeholder="Assign Country" />
                            </SelectTrigger>
                            <SelectContent>
                              {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {u.assignedCountry && (
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
                              {u.assignedCountry}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Applicants Tab (Admin only) ── */}
        {isAdmin && (
          <TabsContent value="users">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Registered Applicants</CardTitle>
                <CardDescription>All registered visa applicants in the system</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {usersQuery.isLoading ? (
                  <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
                ) : applicants.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No applicants yet</div>
                ) : (
                  <div className="divide-y divide-border">
                    {applicants.map(u => (
                      <div key={u.id} className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold">{u.fullName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{u.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            variant={u.emailVerified ? "default" : "secondary"}
                            className={`text-[10px] ${u.emailVerified ? "bg-green-500/20 text-green-600 border-green-500/30" : "text-yellow-600"}`}
                          >
                            {u.emailVerified ? "Verified" : "Unverified"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground hidden sm:block">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Feedback Tab (Admin only) ── */}
        {isAdmin && (
          <TabsContent value="feedback">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquarePlus className="w-4 h-4 text-primary" />
                  User Feedback
                </CardTitle>
                <CardDescription className="text-xs">
                  All feedback submitted by registered applicants.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {feedbackQuery.isLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : !feedbackQuery.data?.length ? (
                  <div className="text-center py-12">
                    <MessageSquarePlus className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                    <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Feedback</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feedbackQuery.data.map(fb => (
                          <tr key={fb.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-feedback-${fb.id}`}>
                            <td className="py-3 px-3 font-medium whitespace-nowrap">{fb.userName}</td>
                            <td className="py-3 px-3 text-muted-foreground font-mono text-xs whitespace-nowrap">{fb.userEmail}</td>
                            <td className="py-3 px-3 max-w-xs">
                              <p className="text-xs text-foreground/80 line-clamp-2">{fb.message}</p>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground text-xs whitespace-nowrap">
                              {new Date(fb.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                              <br />
                              <span className="font-mono">{new Date(fb.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── System Tab (Admin only) ── */}
        {isAdmin && (
          <TabsContent value="system">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    Database Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Total Applications", value: stats?.total ?? 0 },
                    { label: "Applicants Registered", value: applicants.length },
                    { label: "Active Officers", value: officers.length },
                    { label: "Blockchain Entries", value: stats?.blockchainEntries ?? 0 },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between p-2.5 rounded-md bg-muted/50">
                      <span className="text-xs text-muted-foreground">{row.label}</span>
                      <span className="text-sm font-bold">{row.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Applications by Country
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {COUNTRIES.map(country => {
                    const count = apps.filter(a => a.destinationCountry === country).length;
                    const pct = apps.length ? Math.round((count / apps.length) * 100) : 0;
                    return (
                      <div key={country} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{country}</span>
                          <span className="font-mono">{count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Decision Dialog ── */}
      <Dialog open={!!selectedApp && !!actionType} onOpenChange={() => { setSelectedApp(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={actionType === "grant" ? "text-green-600 flex items-center gap-2" : "text-destructive flex items-center gap-2"}>
              {actionType === "grant" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {actionType === "grant" ? "Grant Visa" : "Deny Application"}
            </DialogTitle>
          </DialogHeader>
          {selectedApp && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted text-sm space-y-1">
                <p className="font-medium capitalize">{selectedApp.visaType} Visa</p>
                <p className="text-muted-foreground text-xs">
                  Application #{selectedApp.id} · Destination: {selectedApp.destinationCountry}
                </p>
              </div>
              {actionType === "deny" && (
                <div>
                  <Label className="text-sm">Reason for Denial <span className="text-destructive">*</span></Label>
                  <Textarea
                    className="mt-1.5"
                    placeholder="Provide clear reasons for denial…"
                    value={denialReason}
                    onChange={e => setDenialReason(e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label className="text-sm">Officer Notes (internal)</Label>
                <Textarea
                  className="mt-1.5"
                  placeholder="Internal observations or notes for the record…"
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
              className={actionType === "grant" ? "bg-green-600 hover:bg-green-700" : ""}
              onClick={() => {
                if (!selectedApp || !actionType) return;
                if (actionType === "deny" && !denialReason.trim()) {
                  toast({ title: "Reason Required", description: "Please provide a reason for denial.", variant: "destructive" });
                  return;
                }
                decisionMutation.mutate({ id: selectedApp.id, action: actionType, notes: actionNote, reason: denialReason });
              }}
              disabled={decisionMutation.isPending}
            >
              {decisionMutation.isPending ? "Processing…" : actionType === "grant" ? "Confirm Grant" : "Confirm Denial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create New Officer Dialog ── */}
      <Dialog open={createOfficerOpen} onOpenChange={setCreateOfficerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Create New Immigration Officer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                placeholder="e.g. Japan Immigration Officer"
                value={newOfficer.fullName}
                onChange={e => setNewOfficer(o => ({ ...o, fullName: e.target.value }))}
                data-testid="input-officer-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="e.g. japan_officer@visa.com"
                value={newOfficer.email}
                onChange={e => setNewOfficer(o => ({ ...o, email: e.target.value }))}
                data-testid="input-officer-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Min. 6 characters"
                value={newOfficer.password}
                onChange={e => setNewOfficer(o => ({ ...o, password: e.target.value }))}
                data-testid="input-officer-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Country</Label>
              <Input
                placeholder="e.g. Japan, Germany, Brazil…"
                value={newOfficer.country}
                onChange={e => setNewOfficer(o => ({ ...o, country: e.target.value }))}
                data-testid="input-officer-country"
              />
              <p className="text-xs text-muted-foreground">This officer will only see visa applications for this country.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOfficerOpen(false); setNewOfficer({ fullName: "", email: "", password: "", country: "" }); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newOfficer.fullName || !newOfficer.email || !newOfficer.password || !newOfficer.country) {
                  toast({ title: "All fields required", description: "Please fill in every field before creating the officer.", variant: "destructive" });
                  return;
                }
                if (newOfficer.password.length < 6) {
                  toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
                  return;
                }
                createOfficerMutation.mutate(newOfficer);
              }}
              disabled={createOfficerMutation.isPending}
              data-testid="button-confirm-create-officer"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              {createOfficerMutation.isPending ? "Creating…" : "Create Officer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
