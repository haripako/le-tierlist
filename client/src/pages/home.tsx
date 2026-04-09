import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CLASSES, GAME_MODES, TIER_CONFIG } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import BuildCard from "@/components/build-card";
import type { BuildWithSubmitter, Season } from "@shared/schema";

type TierBuild = BuildWithSubmitter & { score: number; ratio: number; tier: string };
type TierListResponse = Record<string, TierBuild[]>;

export default function HomePage() {
  const [gameMode, setGameMode] = useState("softcore");
  const [classFilter, setClassFilter] = useState("all");

  // Fetch seasons from API
  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/seasons");
      return res.json();
    },
  });

  const activeSeasons = seasons?.filter(s => s.isActive) ?? [];
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const currentSeasonId = seasonId ?? activeSeasons[0]?.id;

  const { data: tierList, isLoading } = useQuery<TierListResponse>({
    queryKey: ["/api/tier-list", currentSeasonId, gameMode],
    queryFn: async () => {
      const params = new URLSearchParams({ gameMode });
      if (currentSeasonId) params.set("seasonId", String(currentSeasonId));
      const res = await apiRequest("GET", `/api/tier-list?${params}`);
      return res.json();
    },
    enabled: !!currentSeasonId,
  });

  const filteredTierList = tierList
    ? Object.fromEntries(
        Object.entries(tierList).map(([tier, builds]) => [
          tier,
          classFilter === "all" ? builds : builds.filter(b => b.className === classFilter),
        ])
      )
    : null;

  const currentSeason = activeSeasons.find(s => s.id === currentSeasonId);
  const currentMode = GAME_MODES.find(m => m.id === gameMode);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="text-page-title">
          Community Tier List
        </h1>
        <p className="text-sm text-muted-foreground">
          Builds ranked by community votes. {currentSeason?.name} {currentMode?.icon} {currentMode?.name}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3" data-testid="filters-section">
        <Select
          value={currentSeasonId ? String(currentSeasonId) : ""}
          onValueChange={v => setSeasonId(parseInt(v))}
        >
          <SelectTrigger className="w-[240px] bg-card border-border" data-testid="select-season">
            <SelectValue placeholder="Season" />
          </SelectTrigger>
          <SelectContent>
            {activeSeasons.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-lg border border-border overflow-hidden">
          {GAME_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => setGameMode(mode.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                gameMode === mode.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-mode-${mode.id}`}
            >
              {mode.icon} {mode.name}
            </button>
          ))}
        </div>

        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[180px] bg-card border-border" data-testid="select-class">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {CLASSES.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tier List */}
      {isLoading || !currentSeasonId ? (
        <div className="space-y-6">
          {["S", "A", "B", "C", "D"].map(tier => (
            <div key={tier} className="space-y-3">
              <Skeleton className="h-8 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTierList ? (
        <div className="space-y-6">
          {(["S", "A", "B", "C", "D"] as const).map(tier => {
            const builds = (filteredTierList[tier] || []) as TierBuild[];
            const config = TIER_CONFIG[tier];
            if (builds.length === 0) return null;

            return (
              <div key={tier} className="space-y-3" data-testid={`tier-section-${tier}`}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg text-white ${config.bgAccent}`}
                    style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                  >
                    {config.label}
                  </div>
                  <div>
                    <span className={`text-sm font-semibold ${config.textColor}`}>{config.description}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {builds.length} build{builds.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {builds.map(build => (
                    <BuildCard key={build.id} build={build} tier={tier} seasonId={currentSeasonId!} gameMode={gameMode} />
                  ))}
                </div>
              </div>
            );
          })}

          {Object.values(filteredTierList).every(arr => arr.length === 0) && (
            <div className="text-center py-16 text-muted-foreground" data-testid="text-empty-state">
              <p className="text-lg font-medium">No builds found</p>
              <p className="text-sm mt-1">Try a different season, game mode, or class filter.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
