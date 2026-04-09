import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ExternalLink, BookOpen } from "lucide-react";
import { SOURCE_CONFIG } from "@/lib/constants";
import type { GameWithMeta, BuildWithSubmitter } from "@shared/schema";

export default function AdminBuildsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedGameId, setSelectedGameId] = useState<string>("all");

  const { data: games } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/games"); return res.json(); },
  });

  const { data: builds, isLoading: buildsLoading } = useQuery<BuildWithSubmitter[]>({
    queryKey: ["/api/admin/builds", user?.id, selectedGameId],
    queryFn: async () => {
      const params = new URLSearchParams({ adminUserId: String(user?.id) });
      if (selectedGameId !== "all") params.set("gameId", selectedGameId);
      const res = await apiRequest("GET", `/api/admin/builds?${params}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/builds/${id}`, { adminUserId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/builds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Build deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const TIER_COLORS: Record<string, string> = {
    S: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    A: "bg-green-500/20 text-green-400 border-green-500/40",
    B: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    C: "bg-purple-500/20 text-purple-400 border-purple-500/40",
    D: "bg-red-500/20 text-red-400 border-red-500/40",
  };

  return (
    <AdminLayout title="Builds">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Select value={selectedGameId} onValueChange={setSelectedGameId}>
            <SelectTrigger className="w-64" data-testid="select-admin-game-builds">
              <SelectValue placeholder="All Games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              {(games ?? []).map(g => (
                <SelectItem key={g.id} value={String(g.id)}>{g.icon} {g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {builds?.length ?? 0} builds
          </span>
        </div>

        <Card data-testid="builds-admin-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> All Builds
            </CardTitle>
          </CardHeader>
          <CardContent>
            {buildsLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14" />)}</div>
            ) : (builds ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No builds found.</p>
            ) : (
              <div className="space-y-2">
                {(builds ?? []).map(build => {
                  const srcConfig = SOURCE_CONFIG[build.sourceType] ?? SOURCE_CONFIG["other"];
                  return (
                    <div key={build.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" data-testid={`build-row-${build.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{build.name}</span>
                          <Badge variant="outline" className="text-[10px]">{build.gameIcon} {build.gameName}</Badge>
                          <span className="text-xs text-muted-foreground">{build.className}</span>
                          {build.gameModeName && (
                            <Badge variant="secondary" className="text-[10px]">{build.gameModeName}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className={`${srcConfig.color}`}>{srcConfig.icon} {srcConfig.name}</span>
                          <span>·</span>
                          <span>↑{build.upvotes} ↓{build.downvotes}</span>
                          <span>· by {build.submitterName}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <a href={build.guideUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" data-testid={`button-view-build-${build.id}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <Button
                          size="sm" variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(build.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-build-${build.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
