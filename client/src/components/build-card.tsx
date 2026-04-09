import { Link } from "wouter";
import { ThumbsUp, ThumbsDown, ExternalLink } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useVoterId } from "@/hooks/use-voter-id";
import { CLASSES, PLAYSTYLES, TIER_CONFIG } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import type { Build } from "@shared/schema";

interface BuildCardProps {
  build: Build & { score?: number; tier?: string };
  tier: string;
  seasonId: string;
  gameMode: string;
}

export default function BuildCard({ build, tier, seasonId, gameMode }: BuildCardProps) {
  const voterId = useVoterId();
  const classInfo = CLASSES.find((c) => c.id === build.className);
  const playstyle = PLAYSTYLES.find((p) => p.id === build.playstyle);
  const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
  const skills: string[] = (() => {
    try { return JSON.parse(build.mainSkills); } catch { return []; }
  })();

  const voteMutation = useMutation({
    mutationFn: async (voteType: "up" | "down") => {
      const res = await apiRequest("POST", `/api/builds/${build.id}/vote`, {
        voterId,
        voteType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tier-list", seasonId, gameMode] });
    },
  });

  const score = build.upvotes - build.downvotes;

  return (
    <div
      className={`group relative rounded-lg border ${tierConfig.color} p-4 transition-all hover:border-opacity-70 hover:shadow-md`}
      data-testid={`card-build-${build.id}`}
    >
      {/* Top row: name + class badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/build/${build.id}`}>
          <h3
            className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer transition-colors leading-tight"
            data-testid={`text-build-name-${build.id}`}
          >
            {build.name}
          </h3>
        </Link>
        <Badge
          variant="outline"
          className="shrink-0 text-[10px] px-1.5 py-0"
          style={{ borderColor: classInfo?.color, color: classInfo?.color }}
        >
          {build.mastery}
        </Badge>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1 mb-3">
        {skills.slice(0, 3).map((skill) => (
          <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
            {skill}
          </span>
        ))}
        {skills.length > 3 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
            +{skills.length - 3}
          </span>
        )}
      </div>

      {/* Bottom row: author, playstyle, votes */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{playstyle?.icon} {playstyle?.name}</span>
          <span>·</span>
          <span>by {build.author}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.preventDefault();
              voteMutation.mutate("up");
            }}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-green-400 transition-colors"
            disabled={voteMutation.isPending}
            data-testid={`button-upvote-${build.id}`}
          >
            <ThumbsUp className="w-3 h-3" />
            <span>{build.upvotes}</span>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              voteMutation.mutate("down");
            }}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-red-400 transition-colors"
            disabled={voteMutation.isPending}
            data-testid={`button-downvote-${build.id}`}
          >
            <ThumbsDown className="w-3 h-3" />
            <span>{build.downvotes}</span>
          </button>
          <span className={`text-[11px] font-semibold ml-1 ${score > 0 ? "text-green-400" : score < 0 ? "text-red-400" : "text-muted-foreground"}`}>
            {score > 0 ? "+" : ""}{score}
          </span>
        </div>
      </div>

      {/* Guide link */}
      {build.guideUrl && (
        <a
          href={build.guideUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
          data-testid={`link-guide-${build.id}`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}
