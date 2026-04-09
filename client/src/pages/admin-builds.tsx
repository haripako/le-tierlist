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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ExternalLink, BookOpen, BarChart2 } from "lucide-react";
import { SOURCE_CONFIG } from "@/lib/constants";
import type { GameWithMeta, BuildWithSubmitter } from "@shared/schema";

export default function AdminBuildsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedGameId, setSelectedGameId] = useState<string>("all");
  const [socialEditBuild, setSocialEditBuild] = useState<BuildWithSubmitter | null>(null);

  // Social edit state
  const [sSocialScore, setSSocialScore] = useState("0");
  const [sSocialViews, setSSocialViews] = useState("0");
  const [sSocialShares, setSSocialShares] = useState("0");
  const [sIsTrending, setSIsTrending] = useState(false);
  const [sIsViral, setSIsViral] = useState(false);
  const [sTrendingReason, setSTrendingReason] = useState("");

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

  const socialMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/builds/${id}/social`, {
        adminUserId: user?.id,
        socialScore: parseInt(sSocialScore),
        socialViews: parseInt(sSocialViews),
        socialShares: parseInt(sSocialShares),
        isTrending: sIsTrending,
        isViral: sIsViral,
        trendingReason: sTrendingReason,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/builds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/builds/trending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/builds/viral"] });
      toast({ title: "Social metrics updated" });
      setSocialEditBuild(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openSocialEdit(build: BuildWithSubmitter) {
    setSocialEditBuild(build);
    setSSocialScore(String((build as any).socialScore ?? 0));
    setSSocialViews(String((build as any).socialViews ?? 0));
    setSSocialShares(String((build as any).socialShares ?? 0));
    setSIsTrending(!!(build as any).isTrending);
    setSIsViral(!!(build as any).isViral);
    setSTrendingReason((build as any).trendingReason ?? "");
  }

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
                  const isTrending = !!(build as any).isTrending;
                  const isViral = !!(build as any).isViral;
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
                          {isTrending && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">🔥</span>}
                          {isViral && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">⚡</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className={`${srcConfig.color}`}>{srcConfig.icon} {srcConfig.name}</span>
                          <span>·</span>
                          <span>↑{build.upvotes} ↓{build.downvotes}</span>
                          <span>· by {build.submitterName}</span>
                          {(build as any).socialScore > 0 && <span>· 📱 {(build as any).socialScore}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => openSocialEdit(build)} title="Edit social metrics" data-testid={`button-social-build-${build.id}`}>
                          <BarChart2 className="w-3.5 h-3.5" />
                        </Button>
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

      {/* Social metrics dialog */}
      <Dialog open={!!socialEditBuild} onOpenChange={open => { if (!open) setSocialEditBuild(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Social Metrics: {socialEditBuild?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Social Score</Label>
                <Input type="number" value={sSocialScore} onChange={e => setSSocialScore(e.target.value)} data-testid="input-social-score" />
              </div>
              <div className="space-y-2">
                <Label>Social Views</Label>
                <Input type="number" value={sSocialViews} onChange={e => setSSocialViews(e.target.value)} data-testid="input-social-views" />
              </div>
              <div className="space-y-2">
                <Label>Social Shares</Label>
                <Input type="number" value={sSocialShares} onChange={e => setSSocialShares(e.target.value)} data-testid="input-social-shares" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={sIsTrending} onCheckedChange={setSIsTrending} data-testid="switch-is-trending" />
                <Label>🔥 Trending</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={sIsViral} onCheckedChange={setSIsViral} data-testid="switch-is-viral" />
                <Label>⚡ Viral</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Trending Reason (optional)</Label>
              <Input value={sTrendingReason} onChange={e => setSTrendingReason(e.target.value)} placeholder="e.g. Featured by streamer X" data-testid="input-trending-reason" />
            </div>
            <Button
              className="w-full"
              onClick={() => socialEditBuild && socialMutation.mutate(socialEditBuild.id)}
              disabled={socialMutation.isPending}
              data-testid="button-save-social"
            >
              {socialMutation.isPending ? "Saving..." : "Save Social Metrics"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
