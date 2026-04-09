import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useVotes } from "@/hooks/use-votes";
import { PLAYSTYLES, SOURCE_CONFIG, getKarmaColor, getKarmaTitle } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronUp, ChevronDown, ArrowLeft, ExternalLink, Calendar, User, Star } from "lucide-react";
import type { BuildWithSubmitter } from "@shared/schema";

export default function BuildDetailPage() {
  const [, params] = useRoute("/build/:id");
  const buildId = params?.id ? parseInt(params.id) : 0;

  const { data: build, isLoading } = useQuery<BuildWithSubmitter>({
    queryKey: ["/api/builds", buildId],
    queryFn: async () => { const res = await apiRequest("GET", `/api/builds/${buildId}`); return res.json(); },
    enabled: buildId > 0,
  });

  const { getVoteState, castVote, isPending } = useVotes([["/api/builds", buildId]]);
  const voteState = build ? getVoteState(build.id) : null;

  if (isLoading) {
    return <div className="max-w-2xl mx-auto space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-72" /></div>;
  }

  if (!build) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Build not found</p>
        <Link href="/"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link>
      </div>
    );
  }

  const modeName = build.gameModeName;
  const playstyle = PLAYSTYLES.find(p => p.id === build.playstyle);
  const source = SOURCE_CONFIG[build.sourceType] || SOURCE_CONFIG.other;
  const skills: string[] = (() => { try { return JSON.parse(build.mainSkills); } catch { return []; } })();
  const score = build.upvotes - build.downvotes;

  // Parse rich content
  const pros: string[] = (() => { try { return JSON.parse((build as any).pros || "[]"); } catch { return []; } })();
  const cons: string[] = (() => { try { return JSON.parse((build as any).cons || "[]"); } catch { return []; } })();
  const engagementText: string = (build as any).engagementText || "";
  const difficulty: string = (build as any).difficulty || "";
  const budgetLevel: string = (build as any).budgetLevel || "";

  const difficultyBadge: Record<string, { label: string; cls: string }> = {
    beginner: { label: "Beginner", cls: "bg-green-500/15 text-green-400 border border-green-500/30" },
    intermediate: { label: "Intermediate", cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
    advanced: { label: "Advanced", cls: "bg-purple-500/15 text-purple-400 border border-purple-500/30" },
    expert: { label: "Expert", cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
  };
  const budgetBadge: Record<string, { label: string; cls: string }> = {
    budget: { label: "Budget", cls: "bg-green-500/15 text-green-400 border border-green-500/30" },
    "mid-range": { label: "Mid-Range", cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
    expensive: { label: "Expensive", cls: "bg-purple-500/15 text-purple-400 border border-purple-500/30" },
    endgame: { label: "Endgame", cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link href="/">
          <button className="hover:text-foreground transition-colors" data-testid="link-games">All Games</button>
        </Link>
        <span>/</span>
        {build.gameSlug && (
          <>
            <Link href={`/game/${build.gameSlug}`}>
              <button className="hover:text-foreground transition-colors flex items-center gap-1">
                {build.gameIcon} {build.gameName}
              </button>
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-foreground truncate max-w-[200px]">{build.name}</span>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
        {/* Header row: title + vote */}
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="text-build-name">
              {build.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs" style={{ borderColor: `${build.gameColor}60`, color: build.gameColor }}>
                {build.gameIcon} {build.gameName}
              </Badge>
              {build.className && (
                <Badge variant="outline" className="text-xs">{build.className}</Badge>
              )}
              {build.mastery && (
                <Badge variant="outline" className="text-xs">{build.mastery}</Badge>
              )}
              {modeName && <Badge variant="secondary" className="text-xs">🎮 {modeName}</Badge>}
              {playstyle && <Badge variant="secondary" className="text-xs">{playstyle.icon} {playstyle.name}</Badge>}
              {build.seasonName && (
                <Badge variant="secondary" className="text-xs">🗓 {build.seasonName}</Badge>
              )}
            </div>
          </div>

          {/* Reddit-style vote column */}
          <div className="flex flex-col items-center gap-1 shrink-0 min-w-[52px]">
            <button
              onClick={() => castVote(build.id, "up")}
              disabled={isPending}
              className={`p-2 rounded-lg transition-colors ${
                voteState === "up"
                  ? "text-primary bg-primary/15"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              }`}
              data-testid="button-upvote"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <span
              className={`text-lg font-bold tabular-nums ${score > 0 ? "text-primary" : score < 0 ? "text-red-400" : "text-muted-foreground"}`}
              data-testid="text-score"
            >
              {score > 0 ? "+" : ""}{score}
            </span>
            <button
              onClick={() => castVote(build.id, "down")}
              disabled={isPending}
              className={`p-2 rounded-lg transition-colors ${
                voteState === "down"
                  ? "text-blue-400 bg-blue-500/15"
                  : "text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10"
              }`}
              data-testid="button-downvote"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Guide link */}
        <a
          href={build.guideUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 text-sm ${source.color} hover:bg-secondary transition-colors`}
          data-testid="link-guide"
        >
          <span className="text-base">{source.icon}</span>
          <div className="flex-1 min-w-0">
            <span className="font-medium">{source.name}</span>
            <p className="text-[11px] text-muted-foreground truncate">{build.guideUrl}</p>
          </div>
          <ExternalLink className="w-4 h-4 shrink-0" />
        </a>

        {/* Engagement text highlight */}
        {engagementText && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3" data-testid="text-engagement-quote">
            <p className="text-sm text-primary italic leading-relaxed">" {engagementText} "</p>
          </div>
        )}

        {/* Difficulty + Budget badges */}
        {(difficulty || budgetLevel) && (
          <div className="flex flex-wrap gap-2">
            {difficulty && difficultyBadge[difficulty] && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${difficultyBadge[difficulty].cls}`} data-testid="badge-difficulty">
                🎯 {difficultyBadge[difficulty].label}
              </span>
            )}
            {budgetLevel && budgetBadge[budgetLevel] && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${budgetBadge[budgetLevel].cls}`} data-testid="badge-budget">
                💰 {budgetBadge[budgetLevel].label}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {build.description && (
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed">{build.description}</p>
          </div>
        )}

        {/* Pros & Cons */}
        {(pros.length > 0 || cons.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pros.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-2">✅ Strengths</p>
                <ul className="space-y-1.5">
                  {pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">⚠️ Weaknesses</p>
                <ul className="space-y-1.5">
                  {cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Main Skills */}
        {skills.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Main Skills</p>
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <span key={skill} className="px-3 py-1 rounded-lg bg-secondary text-sm text-foreground">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Votes breakdown */}
        <div className="flex items-center gap-4 py-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-sm">
            <ChevronUp className="w-4 h-4 text-primary" />
            <span className="font-medium text-primary">{build.upvotes}</span>
            <span className="text-muted-foreground">upvotes</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <ChevronDown className="w-4 h-4 text-red-400" />
            <span className="font-medium text-red-400">{build.downvotes}</span>
            <span className="text-muted-foreground">downvotes</span>
          </div>
          {build.upvotes + build.downvotes > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {Math.round(build.upvotes / (build.upvotes + build.downvotes) * 100)}% upvoted
            </span>
          )}
        </div>

        {/* Submitter */}
        <div className="flex items-center gap-3 py-3 border-t border-border">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-muted-foreground">Submitted by</span>
            <Link href={`/user/${build.submitterId}`}>
              <span className="font-medium text-foreground hover:text-primary cursor-pointer transition-colors">
                {build.submitterName}
              </span>
            </Link>
            {build.submitterKarma > 0 && (
              <span className={`flex items-center gap-0.5 text-xs ${getKarmaColor(build.submitterKarma)}`}>
                <Star className="w-3 h-3" />{build.submitterKarma} · {getKarmaTitle(build.submitterKarma)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
            <Calendar className="w-3 h-3" />
            {new Date(build.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
