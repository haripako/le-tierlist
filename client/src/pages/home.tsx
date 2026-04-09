import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { getCategoryLabel } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, ChevronRight, Trophy } from "lucide-react";
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
      {/* Hero */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="text-page-title">
          Build Tier Lists for Every ARPG
        </h1>
        <p className="text-sm text-muted-foreground">
          Community-ranked builds for Last Epoch, Diablo, Path of Exile, and more. Vote, share, discover.
        </p>
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
                className="relative rounded-xl border border-border overflow-hidden cursor-pointer group transition-all hover:border-opacity-70 hover:shadow-lg"
                style={{ background: `linear-gradient(135deg, ${featured.color}18 0%, transparent 60%)` }}
                data-testid={`card-featured-game`}
              >
                <div
                  className="absolute top-0 right-0 w-48 h-full opacity-10 rounded-xl"
                  style={{ background: `radial-gradient(circle, ${featured.color} 0%, transparent 70%)` }}
                />
                <div className="relative p-6 flex items-center gap-5">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0 shadow-lg"
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
                        className="relative rounded-lg border border-border bg-card cursor-pointer group transition-all hover:shadow-md overflow-hidden"
                        style={{ borderLeftColor: game.color, borderLeftWidth: 3 }}
                        data-testid={`card-game-${game.slug}`}
                      >
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: `linear-gradient(135deg, ${game.color}08 0%, transparent 50%)` }}
                        />
                        <div className="relative p-4 flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
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
