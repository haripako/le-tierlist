import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getKarmaColor, getKarmaTitle, SOURCE_CONFIG, PLAYSTYLES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, ExternalLink, ChevronUp, ChevronDown } from "lucide-react";
import type { BuildWithSubmitter } from "@shared/schema";

type UserProfile = {
  id: number;
  username: string;
  isAdmin: boolean;
  karma: number;
  buildSubmissions: number;
  createdAt: string;
  builds: BuildWithSubmitter[];
};

export default function UserProfilePage() {
  const [, params] = useRoute("/user/:id");
  const userId = params?.id ? parseInt(params.id) : 0;

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/users", userId],
    queryFn: async () => { const res = await apiRequest("GET", `/api/users/${userId}`); return res.json(); },
    enabled: userId > 0,
  });

  if (isLoading) {
    return <div className="max-w-2xl mx-auto space-y-6"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>;
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">User not found</p>
        <Link href="/"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link>
      </div>
    );
  }

  const totalScore = profile.builds.reduce((sum, b) => sum + b.upvotes - b.downvotes, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/">
        <Button variant="ghost" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back</Button>
      </Link>

      {/* Profile card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{profile.username}</h1>
              {profile.isAdmin && <Badge variant="default" className="text-[10px]">Admin</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className={`flex items-center gap-1 font-semibold ${getKarmaColor(profile.karma)}`}>
                <Star className="w-4 h-4" /> {profile.karma} karma
              </span>
              <Badge variant="secondary" className="text-xs">{getKarmaTitle(profile.karma)}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{profile.buildSubmissions}</p>
            <p className="text-xs text-muted-foreground">Builds Submitted</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${totalScore >= 0 ? "text-primary" : "text-red-400"}`}>
              {totalScore > 0 ? "+" : ""}{totalScore}
            </p>
            <p className="text-xs text-muted-foreground">Total Score</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </p>
            <p className="text-xs text-muted-foreground">Member Since</p>
          </div>
        </div>
      </div>

      {/* Submitted builds */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Submitted Builds ({profile.builds.length})
        </h2>
        {profile.builds.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No builds submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {profile.builds.map(build => {
              const source = SOURCE_CONFIG[build.sourceType] || SOURCE_CONFIG.other;
              const playstyle = PLAYSTYLES.find(p => p.id === build.playstyle);
              const score = build.upvotes - build.downvotes;

              return (
                <div key={build.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card" data-testid={`row-build-${build.id}`}>
                  {/* Vote score */}
                  <div className="flex flex-col items-center text-xs shrink-0 w-8">
                    <ChevronUp className={`w-3 h-3 ${score > 0 ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`font-bold tabular-nums ${score > 0 ? "text-primary" : score < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {score}
                    </span>
                    <ChevronDown className={`w-3 h-3 ${score < 0 ? "text-red-400" : "text-muted-foreground"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link href={`/build/${build.id}`}>
                        <span className="text-sm font-medium text-foreground hover:text-primary cursor-pointer transition-colors truncate" data-testid={`text-build-name-${build.id}`}>
                          {build.name}
                        </span>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                      {/* Game */}
                      {build.gameIcon && (
                        <Link href={`/game/${build.gameSlug}`}>
                          <span className="hover:text-primary cursor-pointer flex items-center gap-0.5">
                            {build.gameIcon} {build.gameName}
                          </span>
                        </Link>
                      )}
                      {build.className && <span>{build.className}</span>}
                      {build.mastery && <span>· {build.mastery}</span>}
                      {playstyle && <span>· {playstyle.icon} {playstyle.name}</span>}
                      {build.seasonName && <span>· {build.seasonName}</span>}
                    </div>
                  </div>

                  <a
                    href={build.guideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 text-[11px] ${source.color} hover:underline shrink-0`}
                    data-testid={`link-source-${build.id}`}
                  >
                    {source.icon}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
