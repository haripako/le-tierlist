import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TIER_CONFIG } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import BuildCard from "@/components/build-card";
import { Plus, ArrowLeft, Flame, Zap, Shuffle } from "lucide-react";
import type { GameWithMeta, BuildWithSubmitter, GameMode } from "@shared/schema";

type TierBuild = BuildWithSubmitter & { score: number; ratio: number; tier: string };
type TierListResponse = Record<string, TierBuild[]>;

export default function GamePage() {
  const [, params] = useRoute("/game/:slug");
  const [, navigate] = useLocation();
  const gameSlug = params?.slug ?? "";

  const [seasonId, setSeasonId] = useState<string>("all");
  const [gameModeId, setGameModeId] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"tier-list" | "trending" | "viral">("tier-list");

  // Fetch all games for switcher
  const { data: allGames } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/games");
      return res.json();
    },
  });

  // Fetch game info
  const { data: game, isLoading: gameLoading } = useQuery<GameWithMeta>({
    queryKey: ["/api/games", gameSlug],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/games/${gameSlug}`);
      if (!res.ok) throw new Error("Game not found");
      return res.json();
    },
    enabled: !!gameSlug,
  });

  // Fetch tier list for this game
  const { data: tierList, isLoading: tierLoading } = useQuery<TierListResponse>({
    queryKey: ["/api/games", gameSlug, "tier-list", seasonId, gameModeId],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (gameModeId && gameModeId !== "all") queryParams.set("gameModeId", gameModeId);
      if (seasonId && seasonId !== "all") queryParams.set("seasonId", seasonId);
      const res = await apiRequest("GET", `/api/games/${gameSlug}/tier-list?${queryParams}`);
      return res.json();
    },
    enabled: !!gameSlug,
  });

  const activeSeasons = game?.activeSeasons ?? [];
  const classes = game?.classes ?? [];
  const modes: GameMode[] = game?.modes ?? [];

  // Apply class filter
  const filteredTierList = tierList
    ? Object.fromEntries(
        Object.entries(tierList).map(([tier, builds]) => [
          tier,
          classFilter === "all" ? builds : builds.filter(b => b.className === classFilter),
        ])
      )
    : null;

  const hasBuilds = filteredTierList && Object.values(filteredTierList).some(arr => arr.length > 0);

  if (gameLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="space-y-6">
          {["S", "A", "B"].map(t => (
            <div key={t} className="space-y-3">
              <Skeleton className="h-8 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Skeleton className="h-32" /><Skeleton className="h-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Game not found</p>
        <Link href="/"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Games</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Game switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back-games">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> All Games
          </Button>
        </Link>
        {allGames && allGames.length > 1 && (
          <Select
            value={gameSlug}
            onValueChange={slug => { if (slug !== gameSlug) navigate(`/game/${slug}`); }}
          >
            <SelectTrigger className="w-auto h-8 text-xs bg-card border-border gap-1.5" data-testid="select-game-switcher">
              <Shuffle className="w-3 h-3" />
              <SelectValue placeholder="Switch Game" />
            </SelectTrigger>
            <SelectContent>
              {allGames.map(g => (
                <SelectItem key={g.id} value={g.slug} data-testid={`option-game-${g.slug}`}>
                  <span className="flex items-center gap-1.5">
                    <span>{g.icon}</span>
                    <span>{g.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Game header */}
      <div
        className="rounded-xl border border-border p-5 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${game.color}15 0%, transparent 60%)` }}
        data-testid="game-header"
      >
        <div
          className="absolute top-0 right-0 w-64 h-full opacity-10"
          style={{ background: `radial-gradient(circle, ${game.color} 0%, transparent 70%)` }}
        />
        <div className="relative flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: `${game.color}20`, border: `1px solid ${game.color}40` }}
          >
            {game.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] capitalize"
                style={{ borderColor: `${game.color}60`, color: game.color }}>
                {game.category}
              </Badge>
              {game.buildCount > 0 && (
                <span className="text-[11px] text-muted-foreground">{game.buildCount} builds</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="text-game-title">
              {game.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Community tier list · {classes.length} classes
              {activeSeasons.length > 0 && ` · ${activeSeasons.length} active seasons`}
              {modes.length > 0 && ` · ${modes.length} modes`}
            </p>
          </div>
          <Link href={`/submit?game=${game.slug}`}>
            <Button size="sm" className="shrink-0" data-testid="button-submit-for-game">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Submit Build
            </Button>
          </Link>
        </div>
      </div>

      {/* View Mode Toggle — scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 no-scrollbar">
        <button
          onClick={() => setViewMode("tier-list")}
          className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            viewMode === "tier-list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground border border-border"
          }`}
          data-testid="button-view-tierlist"
        >
          Tier List
        </button>
        <button
          onClick={() => setViewMode("trending")}
          className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            viewMode === "trending" ? "bg-orange-500 text-white" : "bg-card text-muted-foreground hover:text-foreground border border-border"
          }`}
          data-testid="button-view-trending"
        >
          <Flame className="w-3.5 h-3.5" /> Trending
        </button>
        <button
          onClick={() => setViewMode("viral")}
          className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            viewMode === "viral" ? "bg-purple-500 text-white" : "bg-card text-muted-foreground hover:text-foreground border border-border"
          }`}
          data-testid="button-view-viral"
        >
          <Zap className="w-3.5 h-3.5" /> Viral
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3" data-testid="filters-section">
        {/* Season filter — only show if game has seasons */}
        {game.hasSeasons && activeSeasons.length > 0 && (
          <Select value={seasonId} onValueChange={setSeasonId}>
            <SelectTrigger className="w-[240px] bg-card border-border" data-testid="select-season">
              <SelectValue placeholder="All Seasons" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Seasons</SelectItem>
              {activeSeasons.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Game mode toggle — dynamic from API, horizontal scroll on mobile */}
        {modes.length > 0 && (
          <div className="flex rounded-lg border border-border overflow-x-auto max-w-full no-scrollbar" data-testid="mode-toggle-group">
            <button
              onClick={() => setGameModeId("all")}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${gameModeId === "all" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
              data-testid="button-mode-all"
            >
              All
            </button>
            {modes.map(mode => (
              <button
                key={mode.id}
                onClick={() => setGameModeId(String(mode.id))}
                className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors ${gameModeId === String(mode.id) ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                data-testid={`button-mode-${mode.slug}`}
              >
                {mode.name}
              </button>
            ))}
          </div>
        )}

        {/* Class filter */}
        {classes.length > 0 && (
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[180px] bg-card border-border" data-testid="select-class">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Trending / Viral views */}
      {viewMode === "trending" && (
        <div className="space-y-4" data-testid="section-trending">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-orange-400">Trending Builds for {game.name}</h2>
          </div>
          {filteredTierList && Object.values(filteredTierList).flat().filter((b: any) => b.isTrending).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No trending builds for this game yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTierList && (Object.values(filteredTierList).flat() as TierBuild[]).filter(b => b.isTrending).map(build => (
                <BuildCard key={build.id} build={build} tier={build.tier || "C"} gameSlug={gameSlug}
                  invalidateKey={["/api/games", gameSlug, "tier-list", seasonId, gameModeId]} />
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === "viral" && (
        <div className="space-y-4" data-testid="section-viral">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-purple-400">Viral Builds for {game.name}</h2>
          </div>
          {filteredTierList && Object.values(filteredTierList).flat().filter((b: any) => b.isViral).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No viral builds for this game yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTierList && (Object.values(filteredTierList).flat() as TierBuild[]).filter(b => b.isViral).map(build => (
                <BuildCard key={build.id} build={build} tier={build.tier || "C"} gameSlug={gameSlug}
                  invalidateKey={["/api/games", gameSlug, "tier-list", seasonId, gameModeId]} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tier List */}
      {viewMode === "tier-list" && tierLoading ? (
        <div className="space-y-6">
          {["S", "A", "B", "C", "D", "N"].map(tier => (
            <div key={tier} className="space-y-3">
              <Skeleton className="h-8 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Skeleton className="h-32" /><Skeleton className="h-32" />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "tier-list" && filteredTierList ? (
        <div className="space-y-6">
          {(["S", "A", "B", "C", "D", "N"] as const).map(tier => {
            const tierBuilds = (filteredTierList[tier] || []) as TierBuild[];
            const config = TIER_CONFIG[tier];
            if (tierBuilds.length === 0) return null;

            return (
              <div key={tier} className="space-y-3" data-testid={`tier-section-${tier}`}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${tier === 'N' ? 'bg-gray-500/20 text-gray-400' : 'text-white ' + config.bgAccent}`}
                    style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                  >
                    {config.label}
                  </div>
                  <div>
                    <span className={`text-sm font-semibold ${config.textColor}`}>{config.description}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {tierBuilds.length} build{tierBuilds.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tierBuilds.map(build => (
                    <BuildCard
                      key={build.id}
                      build={build}
                      tier={tier}
                      gameSlug={gameSlug}
                      invalidateKey={["/api/games", gameSlug, "tier-list", seasonId, gameModeId]}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {!hasBuilds && (
            <div className="text-center py-16 text-muted-foreground" data-testid="text-empty-state">
              <p className="text-lg font-medium">No builds yet</p>
              <p className="text-sm mt-1">Be the first to submit a build for {game.name}!</p>
              <Link href={`/submit?game=${game.slug}`}>
                <Button className="mt-4">
                  <Plus className="w-4 h-4 mr-2" /> Submit a Build
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
