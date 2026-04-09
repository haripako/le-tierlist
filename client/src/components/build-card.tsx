import { Link } from "wouter";
import { ChevronUp, ChevronDown, ExternalLink, Star } from "lucide-react";
import { useVotes } from "@/hooks/use-votes";
import { PLAYSTYLES, TIER_CONFIG, SOURCE_CONFIG, getKarmaColor } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
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

  const voteState = getVoteState(build.id);
  const playstyle = PLAYSTYLES.find(p => p.id === build.playstyle);
  const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
  const source = SOURCE_CONFIG[build.sourceType] || SOURCE_CONFIG.other;
  const skills: string[] = (() => {
    try { return JSON.parse(build.mainSkills); } catch { return []; }
  })();

  const score = build.upvotes - build.downvotes;

  return (
    <div
      className={`group relative rounded-lg border ${tierConfig.color} p-4 transition-all hover:border-opacity-70 hover:shadow-md`}
      data-testid={`card-build-${build.id}`}
    >
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

          {/* Footer: submitter + playstyle */}
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
        </div>
      </div>
    </div>
  );
}
