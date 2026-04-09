import { useState } from "react";
import { Link } from "wouter";
import { ExternalLink, Bookmark, Flag } from "lucide-react";
import { useTierVotes } from "@/hooks/use-tier-votes";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAuth } from "@/hooks/use-auth";
import { PLAYSTYLES, TIER_CONFIG, TIER_VOTE_CONFIG, SOURCE_CONFIG } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BuildWithSubmitter } from "@shared/schema";

const TIER_ORDER = ["S+", "S", "A", "B", "C", "D"] as const;

interface BuildCardProps {
  build: BuildWithSubmitter & { score?: number; tier?: string };
  tier: string;
  gameSlug?: string;
  invalidateKey?: any[];
}

export default function BuildCard({ build, tier, gameSlug, invalidateKey }: BuildCardProps) {
  const keys = invalidateKey ? [invalidateKey] : undefined;
  const { getMyVote, castVote, isPending } = useTierVotes(keys);
  const { isBookmarked, toggleBookmark } = useBookmarks(keys);
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();
  const [reportSent, setReportSent] = useState(false);

  const myVote = getMyVote(build.id);
  const bookmarked = isBookmarked(build.id);
  const playstyle = PLAYSTYLES.find(p => p.id === build.playstyle);
  const calculatedTier = build.calculatedTier || tier || "N";
  const tierConfig = TIER_CONFIG[calculatedTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.N;
  const source = SOURCE_CONFIG[build.sourceType] || SOURCE_CONFIG.other;
  const skills: string[] = (() => {
    try { return JSON.parse(build.mainSkills); } catch { return []; }
  })();

  const tierVoteCount = build.tierVoteCount ?? 0;
  const bookmarkCount = build.bookmarkCount ?? 0;
  const socialScore = build.socialScore ?? 0;
  const thumbnailUrl = (build as any).thumbnailUrl as string | null | undefined;

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
    if (!isLoggedIn) {
      toast({ title: "Sign in to report builds", variant: "destructive" });
      return;
    }
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

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Name + mastery/thumbnail row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Tier badge */}
            <span
              className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold border ${tierConfig.color}`}
              data-testid={`badge-tier-${build.id}`}
            >
              {calculatedTier}
            </span>
            <Link href={`/build/${build.id}`}>
              <h3 className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer transition-colors leading-tight" data-testid={`text-build-name-${build.id}`}>
                {build.name}
              </h3>
            </Link>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {build.mastery ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: `${build.gameColor}60`, color: build.gameColor }}>
                {build.mastery}
              </Badge>
            ) : build.className ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: `${build.gameColor}60`, color: build.gameColor }}>
                {build.className}
              </Badge>
            ) : null}
            {/* Thumbnail */}
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt=""
                className="w-12 h-12 rounded object-cover border border-border shrink-0"
                data-testid={`img-thumbnail-${build.id}`}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </div>
        </div>

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

        {/* Engagement text teaser — larger, not italic, 2 lines */}
        {engagementText && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-snug" data-testid={`text-engagement-${build.id}`}>
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

        {/* Tier vote buttons */}
        <div className="pt-1">
          <div className="flex items-center gap-1 flex-wrap" data-testid={`tier-vote-buttons-${build.id}`}>
            <span className="text-[10px] text-muted-foreground mr-0.5">Rate:</span>
            {TIER_ORDER.map(t => {
              const cfg = TIER_VOTE_CONFIG[t];
              const isActive = myVote === t;
              return (
                <button
                  key={t}
                  onClick={() => castVote(build.id, t)}
                  disabled={isPending}
                  title={`Vote ${t} tier`}
                  data-testid={`button-tier-vote-${t}-${build.id}`}
                  className={`
                    inline-flex items-center justify-center
                    px-2 py-0.5 rounded text-[11px] font-bold
                    border transition-all
                    ${isActive
                      ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder} scale-110`
                      : `${cfg.bg} ${cfg.text} ${cfg.border} hover:scale-105`
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {t}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-muted-foreground" data-testid={`text-vote-count-${build.id}`}>
              {tierVoteCount > 0
                ? `${tierVoteCount} vote${tierVoteCount === 1 ? "" : "s"} · Median: `
                : "No votes yet"}
            </span>
            {tierVoteCount > 0 && (
              <span className={`text-[10px] font-bold ${(TIER_CONFIG[calculatedTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.N).textColor}`}>
                {calculatedTier}
              </span>
            )}
          </div>
        </div>

        {/* Footer: submitter + actions */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {playstyle && <span>{playstyle.icon}</span>}
            <span className="truncate">
              by{" "}
              <Link href={`/user/${build.submitterId}`}>
                <span className="hover:text-primary cursor-pointer">{build.submitterName}</span>
              </Link>
            </span>
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
            {isLoggedIn && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
