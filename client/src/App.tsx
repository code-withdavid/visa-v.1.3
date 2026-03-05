import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/components/theme-provider";
import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import NewApplication from "@/pages/new-application";
import ApplicationDetail from "@/pages/application-detail";
import OfficerDashboard from "@/pages/officer-dashboard";
import BlockchainLedger from "@/pages/blockchain-ledger";
import ChatBot from "@/pages/chatbot";
import NotFound from "@/pages/not-found";

function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading VisaFlow...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/auth" />;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50 h-12">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="-ml-1" />
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 pulse-glow" />
              <span className="text-xs text-muted-foreground font-mono">SYSTEM ONLINE</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/applications/new" component={NewApplication} />
              <Route path="/applications/:id" component={ApplicationDetail} />
              <Route path="/officer" component={OfficerDashboard} />
              <Route path="/blockchain" component={BlockchainLedger} />
              <Route path="/chat" component={ChatBot} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route>
        <ProtectedLayout />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
