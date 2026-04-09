import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Gamepad2, Layers, Users, Star, BookOpen, Swords, Share2, Tag, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: Shield },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/games", label: "Games", icon: Gamepad2 },
  { href: "/admin/game-modes", label: "Game Modes", icon: Layers },
  { href: "/admin/classes", label: "Classes", icon: Swords },
  { href: "/admin/seasons", label: "Seasons", icon: Star },
  { href: "/admin/builds", label: "Builds", icon: BookOpen },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/social", label: "Social Queue", icon: Share2 },
  { href: "/admin/users", label: "Users", icon: Users },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const [location] = useLocation();
  const { isAdmin, isLoggedIn, user } = useAuth();

  const { data: reports } = useQuery<any[]>({
    queryKey: ["/api/admin/reports", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/reports?adminUserId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
    staleTime: 30_000,
  });
  const reportCount = reports?.length ?? 0;

  if (!isLoggedIn || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-24 text-center text-muted-foreground">
        <div>
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">Admin access required</p>
          <p className="text-sm mt-1">You must be logged in as an admin to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <aside className="w-48 shrink-0" data-testid="admin-sidebar">
        <div className="sticky top-20 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 pb-2">
            Admin Panel
          </p>
          {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || (href !== "/admin" && location.startsWith(href));
            const isReports = href === "/admin/reports";
            return (
              <Link key={href} href={href}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  data-testid={`admin-nav-${label.toLowerCase().replace(/ /g, "-")}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="flex-1">{label}</span>
                  {isReports && reportCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 min-w-[16px]">
                      {reportCount}
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-12">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            {title}
          </h1>
        </div>
        {children}
      </main>
    </div>
  );
}
