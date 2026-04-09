import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { getCategoryLabel } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, ChevronRight, Trophy, TrendingUp, Zap } from "lucide-react";
import type { GameWithMeta } from "@shared/schema";

const CATEGORY_ORDER = ["arpg", "looter-shooter", "mmo", "other"];

export default function HomePage() {
  const { data: gamesRaw, isLoading } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/games");
      return res.json();
    },
  });

  const games = gamesRaw ?? [];

  // Aggregate stats
  const totalBuilds = games.reduce((sum, g) => sum + g.buildCount, 0);

  // Featured game: Last Epoch
  const featured = games.find(g => g.slug === "last-epoch");

  // Group by category
  const grouped: Record<string, GameWithMeta[]> = {};
  for (const g of games) {
    if (!grouped[g.category]) grouped[g.category] = [];
    grouped[g.category].push(g);
  }

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card px-6 py-8 sm:px-10 sm:py-10">
        {/* Ambient background glow */}
        <div
          className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(38 90% 50%) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-5 blur-2xl pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(38 90% 60%) 0%, transparent 70%)" }}
        />

        <div className="relative">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 mb-4">
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Community Powered
            </span>
          </div>

          {/* Headline with gradient text */}
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight mb-2 leading-tight"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
            data-testid="text-page-title"
          >
            <span
              style={{
                background: "linear-gradient(135deg, hsl(38 90% 55%) 0%, hsl(30 85% 50%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Build Tier Lists
            </span>
            {" "}
            <span className="text-foreground">for Every ARPG</span>
          </h1>

          <p className="text-sm text-muted-foreground max-w-lg mb-5">
            Community-ranked builds for Last Epoch, Diablo, Path of Exile, and more.
            Vote, share, and discover what's truly meta.
          </p>

          {/* Stats row */}
          {!isLoading && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Trophy className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">{totalBuilds.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">total builds</p>
                </div>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">{games.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">games tracked</p>
                </div>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">
                    {games.reduce((sum, g) => sum + g.classes.length, 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">classes</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <Skeleton className="h-40 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        </div>
      ) : (
        <>
          {/* Featured */}
          {featured && (
            <Link href={`/game/${featured.slug}`}>
              <div
                className="relative rounded-xl border border-border overflow-hidden cursor-pointer group transition-all hover:border-opacity-70 hover:shadow-lg hover:shadow-black/20"
                style={{ background: `linear-gradient(135deg, ${featured.color}18 0%, transparent 60%)` }}
                data-testid={`card-featured-game`}
              >
                <div
                  className="absolute top-0 right-0 w-48 h-full opacity-10 rounded-xl"
                  style={{ background: `radial-gradient(circle, ${featured.color} 0%, transparent 70%)` }}
                />
                {/* Subtle animated shine on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `linear-gradient(105deg, transparent 40%, ${featured.color}08 50%, transparent 60%)` }}
                />
                <div className="relative p-6 flex items-center gap-5">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0 shadow-lg transition-transform group-hover:scale-105 duration-200"
                    style={{ background: `${featured.color}22`, border: `1px solid ${featured.color}44` }}
                  >
                    {featured.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-3.5 h-3.5" style={{ color: featured.color }} />
                      <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: featured.color }}>
                        Featured
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                      {featured.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {featured.buildCount} builds · {featured.classes.length} classes · {featured.activeSeasons.length} active seasons
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                    <span className="text-sm font-medium hidden sm:block">View Tier List</span>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Games by category */}
          {CATEGORY_ORDER.map(cat => {
            const catGames = grouped[cat];
            if (!catGames || catGames.length === 0) return null;
            return (
              <section key={cat} className="space-y-4" data-testid={`section-category-${cat}`}>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    {getCategoryLabel(cat)}
                  </h2>
                  <Badge variant="secondary" className="text-[10px]">{catGames.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {catGames.map(game => (
                    <Link key={game.id} href={`/game/${game.slug}`}>
                      <div
                        className="relative rounded-lg border border-border bg-card cursor-pointer group transition-all hover:shadow-md hover:shadow-black/10 overflow-hidden"
                        style={{ borderLeftColor: game.color, borderLeftWidth: 3 }}
                        data-testid={`card-game-${game.slug}`}
                      >
                        {/* Hover overlay */}
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{ background: `linear-gradient(135deg, ${game.color}0a 0%, transparent 50%)` }}
                        />
                        {/* Right glow accent */}
                        <div
                          className="absolute top-0 right-0 w-16 h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{ background: `radial-gradient(circle at right, ${game.color}12 0%, transparent 70%)` }}
                        />
                        <div className="relative p-4 flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105 duration-200"
                            style={{ background: `${game.color}18` }}
                          >
                            {game.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate" data-testid={`text-game-name-${game.slug}`}>
                              {game.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {game.buildCount > 0 ? `${game.buildCount} builds` : "No builds yet"}
                              {game.classes.length > 0 && ` · ${game.classes.length} classes`}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
