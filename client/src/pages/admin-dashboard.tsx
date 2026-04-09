import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Gamepad2, Layers, Star, BookOpen, Users, Swords, ArrowRight } from "lucide-react";
import type { GameWithMeta } from "@shared/schema";

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const { data: games, isLoading: gamesLoading } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/games"); return res.json(); },
  });

  const { data: seasons, isLoading: seasonsLoading } = useQuery<any[]>({
    queryKey: ["/api/seasons"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/seasons"); return res.json(); },
  });

  const { data: allBuilds } = useQuery<any[]>({
    queryKey: ["/api/admin/builds", user?.id],
    queryFn: async () => { const res = await apiRequest("GET", `/api/admin/builds?adminUserId=${user?.id}`); return res.json(); },
    enabled: !!user?.isAdmin,
  });

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/admin/users", user?.id],
    queryFn: async () => { const res = await apiRequest("GET", `/api/admin/users?adminUserId=${user?.id}`); return res.json(); },
    enabled: !!user?.isAdmin,
  });

  const stats = [
    { label: "Games", value: games?.length ?? 0, icon: Gamepad2, href: "/admin/games", color: "text-blue-400" },
    { label: "Game Modes", value: games?.reduce((sum, g) => sum + (g.modes?.length ?? 0), 0) ?? 0, icon: Layers, href: "/admin/game-modes", color: "text-purple-400" },
    { label: "Seasons", value: seasons?.length ?? 0, icon: Star, href: "/admin/seasons", color: "text-yellow-400" },
    { label: "Total Builds", value: allBuilds?.length ?? 0, icon: BookOpen, href: "/admin/builds", color: "text-green-400" },
    { label: "Users", value: allUsers?.length ?? 0, icon: Users, href: "/admin/users", color: "text-orange-400" },
    { label: "Classes", value: games?.reduce((sum, g) => sum + (g.classes?.length ?? 0), 0) ?? 0, icon: Swords, href: "/admin/classes", color: "text-red-400" },
  ];

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="admin-stats-grid">
          {stats.map(stat => (
            <Link key={stat.label} href={stat.href}>
              <Card className="cursor-pointer hover:border-primary/40 transition-colors" data-testid={`admin-stat-${stat.label.toLowerCase().replace(/ /g, "-")}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/admin/games">
              <Button variant="outline" className="w-full justify-between" data-testid="admin-action-games">
                Manage Games <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Link href="/admin/game-modes">
              <Button variant="outline" className="w-full justify-between" data-testid="admin-action-game-modes">
                Manage Game Modes <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Link href="/admin/seasons">
              <Button variant="outline" className="w-full justify-between" data-testid="admin-action-seasons">
                Manage Seasons <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Link href="/admin/builds">
              <Button variant="outline" className="w-full justify-between" data-testid="admin-action-builds">
                Manage Builds <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Games summary */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Games Overview</h2>
          {gamesLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="space-y-2">
              {(games ?? []).map(game => (
                <div key={game.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card" data-testid={`admin-game-row-${game.id}`}>
                  <span className="text-lg">{game.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{game.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.buildCount} builds · {game.modes?.length ?? 0} modes · {game.classes?.length ?? 0} classes
                      {game.hasSeasons && " · has seasons"}
                    </p>
                  </div>
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: game.color }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
