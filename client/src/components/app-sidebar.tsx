import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, FilePlus, Shield, Link2, MessageSquareText,
  LogOut, Globe, Users, ChevronRight, User, MessageSquarePlus,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const applicantItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "New Application", url: "/applications/new", icon: FilePlus },
  { title: "AI Assistant", url: "/chat", icon: MessageSquareText },
  { title: "Feedback", url: "/feedback", icon: MessageSquarePlus },
];

const officerItems = [
  { title: "Officer Dashboard", url: "/officer", icon: Users },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isOfficer = user?.role === "officer" || user?.role === "admin";
  const items = isOfficer ? officerItems : applicantItems;

  const initials = user?.fullName
    ? user.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <Sidebar style={{ background: "linear-gradient(170deg, #0a0f3c 0%, #131c70 40%, #1e2d90 75%, #2a3ab0 100%)" }}>
      {/* Header */}
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm truncate text-[#fffcfc] bg-[#3248b300]">VisaFlow</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator className="bg-white/10" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-mono tracking-widest text-sidebar-foreground/40 uppercase">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.title}</span>
                        {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOfficer && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-mono tracking-widest text-sidebar-foreground/40 uppercase">
              Officer Access
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2">
                <Badge variant="secondary" className="text-[10px] font-mono gap-1 w-full justify-center">
                  <Shield className="w-2.5 h-2.5" />
                  {user?.role?.toUpperCase()}
                </Badge>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="pb-4">
        <SidebarSeparator className="mb-3 bg-white/10" />

        {/* User info */}
        <div className="px-2 flex items-center gap-2 mb-3">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">{user?.fullName}</span>
            <span className="text-[10px] text-sidebar-foreground/50 font-mono truncate">{user?.email}</span>
          </div>
        </div>

        <div className="px-2 flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-1.5 text-destructive"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
