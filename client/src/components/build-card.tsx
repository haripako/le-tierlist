import { useState } from "react";
import { Link } from "wouter";
import { ChevronUp, ChevronDown, ExternalLink, Star, Bookmark, Flag } from "lucide-react";
import { useVotes } from "@/hooks/use-votes";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { PLAYSTYLES, TIER_CONFIG, SOURCE_CONFIG, getKarmaColor } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BuildWithSubmitter } from "@shared/schema";

interface BuildCardProps {
  build: BuildWithSubmitter & { score?: number; tier?: string };
  tier: string;
  gameSlug?: string;
  invalidateKey?: any[];
}

export default function BuildCard({ build, tier, gameSlug, invalidateKey }: BuildCardProps) {
  const keys = invalidateKey ? [invalidateKey] : undefined;
  const { getVoteState, castVote, isPending } = useVotes(keys);
  const { isBookmarked, toggleBookmark } = useBookmarks(keys);
  const { toast } = useToast();
  const [reportSent, setReportSent] = useState(false);

  const voteState = getVoteState(build.id);
  const bookmarked = isBookmarked(build.id);
  const playstyle = PLAYSTYLES.find(p => p.id === build.playstyle);
  const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
  const source = SOURCE_CONFIG[build.sourceType] || SOURCE_CONFIG.other;
  const skills: string[] = (() => {
    try { return JSON.parse(build.mainSkills); } catch { return []; }
  })();

  const score = build.upvotes - build.downvotes;
  const bookmarkCount = build.bookmarkCount ?? 0;
  const socialScore = build.socialScore ?? 0;

  // Parse rich content fields
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

  const handleReport = async () => {
    if (reportSent) return;
    try {
      await apiRequest("POST", `/api/builds/${build.id}/report`, { reason: "inappropriate" });
      setReportSent(true);
      toast({ title: "Build reported", description: "Thanks for flagging this." });
    } catch {
      toast({ title: "Failed to report", variant: "destructive" });
    }
  };

  return (
    <div
      className={`group relative rounded-lg border ${tierConfig.color} p-4 transition-all hover:border-opacity-70 hover:shadow-md`}
      data-testid={`card-build-${build.id}`}
    >
      {/* Social badges */}
      {(build.isTrending || build.isViral) && (
        <div className="flex gap-1.5 mb-2">
          {build.isTrending && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
              🔥 Trending
            </span>
          )}
          {build.isViral && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
              ⚡ Viral
            </span>
          )}
        </div>
      )}

      {/* Vote column + content */}
      <div className="flex gap-3">
        {/* Reddit-style vote column */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={() => castVote(build.id, "up")}
            disabled={isPending}
            className={`p-1 rounded transition-colors ${
              voteState === "up"
                ? "text-primary bg-primary/15"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10"
            }`}
            data-testid={`button-upvote-${build.id}`}
            title="Upvote"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span
            className={`text-xs font-bold tabular-nums ${
              score > 0 ? "text-primary" : score < 0 ? "text-red-400" : "text-muted-foreground"
            }`}
            data-testid={`text-score-${build.id}`}
          >
            {score}
          </span>
          <button
            onClick={() => castVote(build.id, "down")}
            disabled={isPending}
            className={`p-1 rounded transition-colors ${
              voteState === "down"
                ? "text-blue-400 bg-blue-500/15"
                : "text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10"
            }`}
            data-testid={`button-downvote-${build.id}`}
            title="Downvote"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Name + mastery */}
          <div className="flex items-start justify-between gap-2">
            <Link href={`/build/${build.id}`}>
              <h3 className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer transition-colors leading-tight" data-testid={`text-build-name-${build.id}`}>
                {build.name}
              </h3>
            </Link>
            {build.mastery && (
              <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0" style={{ borderColor: `${build.gameColor}60`, color: build.gameColor }}>
                {build.mastery}
              </Badge>
            )}
          </div>

          {/* Class name if no mastery */}
          {!build.mastery && build.className && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: `${build.gameColor}60`, color: build.gameColor }}>
              {build.className}
            </Badge>
          )}

          {/* Source link */}
          <a
            href={build.guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 text-[11px] ${source.color} hover:underline`}
            data-testid={`link-source-${build.id}`}
          >
            <span>{source.icon}</span>
            <span>{source.name}</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>

          {/* Engagement text teaser */}
          {engagementText && (
            <p className="text-[11px] text-muted-foreground italic truncate" data-testid={`text-engagement-${build.id}`}>
              {engagementText}
            </p>
          )}

          {/* Difficulty + Budget badges */}
          {(difficulty || budgetLevel) && (
            <div className="flex flex-wrap gap-1">
              {difficulty && difficultyBadge[difficulty] && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${difficultyBadge[difficulty].cls}`} data-testid={`badge-difficulty-${build.id}`}>
                  {difficultyBadge[difficulty].label}
                </span>
              )}
              {budgetLevel && budgetBadge[budgetLevel] && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${budgetBadge[budgetLevel].cls}`} data-testid={`badge-budget-${build.id}`}>
                  💰 {budgetBadge[budgetLevel].label}
                </span>
              )}
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skills.slice(0, 3).map(skill => (
                <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{skill}</span>
              ))}
              {skills.length > 3 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">+{skills.length - 3}</span>
              )}
            </div>
          )}

          {/* Footer: submitter + playstyle + social indicators */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {playstyle && <span>{playstyle.icon}</span>}
              <span className="truncate">
                by{" "}
                <Link href={`/user/${build.submitterId}`}>
                  <span className="hover:text-primary cursor-pointer">{build.submitterName}</span>
                </Link>
              </span>
              {build.submitterKarma > 0 && (
                <span className={`flex items-center gap-0.5 shrink-0 ${getKarmaColor(build.submitterKarma)}`}>
                  <Star className="w-2.5 h-2.5" />{build.submitterKarma}
                </span>
              )}
            </div>

            {/* Bookmark + Report + Social score */}
            <div className="flex items-center gap-1.5 shrink-0">
              {socialScore > 0 && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5" data-testid={`text-social-score-${build.id}`}>
                  📱 {socialScore >= 1000 ? `${(socialScore / 1000).toFixed(1)}k` : socialScore}
                </span>
              )}
              {bookmarkCount > 0 && (
                <span className="text-[10px] text-muted-foreground" data-testid={`text-bookmark-count-${build.id}`}>
                  {bookmarkCount}
                </span>
              )}
              <button
                onClick={() => toggleBookmark(build.id)}
                className={`p-1 rounded transition-colors ${
                  bookmarked
                    ? "text-yellow-400 hover:text-yellow-300"
                    : "text-muted-foreground hover:text-yellow-400"
                }`}
                data-testid={`button-bookmark-${build.id}`}
                title={bookmarked ? "Remove bookmark" : "Bookmark"}
              >
                <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? "fill-yellow-400" : ""}`} />
              </button>
              <button
                onClick={handleReport}
                className={`p-1 rounded transition-colors ${
                  reportSent
                    ? "text-red-400"
                    : "text-muted-foreground hover:text-red-400"
                }`}
                data-testid={`button-report-${build.id}`}
                title="Report build"
              >
                <Flag className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
