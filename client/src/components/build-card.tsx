import { Link } from "wouter";
import { ThumbsUp, ThumbsDown, ExternalLink, Star } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { CLASSES, PLAYSTYLES, TIER_CONFIG, SOURCE_CONFIG, getKarmaColor } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { BuildWithSubmitter } from "@shared/schema";

interface BuildCardProps {
  build: BuildWithSubmitter & { score?: number; tier?: string };
  tier: string;
  seasonId: number;
  gameMode: string;
}

export default function BuildCard({ build, tier, seasonId, gameMode }: BuildCardProps) {
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const classInfo = CLASSES.find(c => c.id === build.className);
  const playstyle = PLAYSTYLES.find(p => p.id === build.playstyle);
  const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
  const source = SOURCE_CONFIG[build.sourceType] || SOURCE_CONFIG.other;
  const skills: string[] = (() => {
    try { return JSON.parse(build.mainSkills); } catch { return []; }
  })();

  const voteMutation = useMutation({
    mutationFn: async (voteType: "up" | "down") => {
      if (!isLoggedIn) throw new Error("login");
      const res = await apiRequest("POST", `/api/builds/${build.id}/vote`, { userId: user!.id, voteType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tier-list", seasonId, gameMode] });
    },
    onError: (e: Error) => {
      if (e.message === "login") toast({ title: "Sign in required", description: "You need to sign in to vote.", variant: "destructive" });
    },
  });

  const score = build.upvotes - build.downvotes;

  return (
    <div
      className={`group relative rounded-lg border ${tierConfig.color} p-4 transition-all hover:border-opacity-70 hover:shadow-md`}
      data-testid={`card-build-${build.id}`}
    >
      {/* Top: name + class */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <Link href={`/build/${build.id}`}>
          <h3 className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer transition-colors leading-tight" data-testid={`text-build-name-${build.id}`}>
            {build.name}
          </h3>
        </Link>
        <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0" style={{ borderColor: classInfo?.color, color: classInfo?.color }}>
          {build.mastery}
        </Badge>
      </div>

      {/* Source link */}
      <a
        href={build.guideUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-[11px] ${source.color} hover:underline mb-2`}
        data-testid={`link-source-${build.id}`}
      >
        <span>{source.icon}</span>
        <span>{source.name}</span>
        <ExternalLink className="w-2.5 h-2.5" />
      </a>

      {/* Skills */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {skills.slice(0, 3).map(skill => (
          <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{skill}</span>
        ))}
        {skills.length > 3 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">+{skills.length - 3}</span>
        )}
      </div>

      {/* Bottom: submitter + votes */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
          <span>{playstyle?.icon}</span>
          <span className="truncate">
            by{" "}
            <Link href={`/user/${build.submitterId}`}>
              <span className="hover:text-primary cursor-pointer">{build.submitterName}</span>
            </Link>
          </span>
          <span className={`flex items-center gap-0.5 shrink-0 ${getKarmaColor(build.submitterKarma)}`}>
            <Star className="w-2.5 h-2.5" />{build.submitterKarma}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => voteMutation.mutate("up")}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-green-400 transition-colors"
            disabled={voteMutation.isPending}
            data-testid={`button-upvote-${build.id}`}
          >
            <ThumbsUp className="w-3 h-3" />
            <span>{build.upvotes}</span>
          </button>
          <button
            onClick={() => voteMutation.mutate("down")}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-red-400 transition-colors"
            disabled={voteMutation.isPending}
            data-testid={`button-downvote-${build.id}`}
          >
            <ThumbsDown className="w-3 h-3" />
            <span>{build.downvotes}</span>
          </button>
          <span className={`text-[11px] font-semibold ml-0.5 ${score > 0 ? "text-green-400" : score < 0 ? "text-red-400" : "text-muted-foreground"}`}>
            {score > 0 ? "+" : ""}{score}
          </span>
        </div>
      </div>
    </div>
  );
}
