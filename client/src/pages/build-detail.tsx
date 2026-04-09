import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useVoterId } from "@/hooks/use-voter-id";
import { CLASSES, SEASONS, GAME_MODES, PLAYSTYLES } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp, ThumbsDown, ArrowLeft, ExternalLink, Calendar, User, Swords } from "lucide-react";
import { Link } from "wouter";
import type { Build } from "@shared/schema";

export default function BuildDetailPage() {
  const [, params] = useRoute("/build/:id");
  const buildId = params?.id ? parseInt(params.id) : 0;
  const voterId = useVoterId();

  const { data: build, isLoading } = useQuery<Build>({
    queryKey: ["/api/builds", buildId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/builds/${buildId}`);
      return res.json();
    },
    enabled: buildId > 0,
  });

  const voteMutation = useMutation({
    mutationFn: async (voteType: "up" | "down") => {
      const res = await apiRequest("POST", `/api/builds/${buildId}/vote`, {
        voterId,
        voteType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/builds", buildId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tier-list"] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!build) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Build not found</p>
        <Link href="/">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tier List
          </Button>
        </Link>
      </div>
    );
  }

  const classInfo = CLASSES.find((c) => c.id === build.className);
  const season = SEASONS.find((s) => s.id === build.seasonId);
  const mode = GAME_MODES.find((m) => m.id === build.gameMode);
  const playstyle = PLAYSTYLES.find((p) => p.id === build.playstyle);
  const skills: string[] = (() => {
    try { return JSON.parse(build.mainSkills); } catch { return []; }
  })();
  const score = build.upvotes - build.downvotes;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <Link href="/">
        <Button variant="ghost" size="sm" data-testid="button-back">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Tier List
        </Button>
      </Link>

      {/* Build header */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
              data-testid="text-build-name"
            >
              {build.name}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: classInfo?.color, color: classInfo?.color }}
              >
                {classInfo?.name}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {build.mastery}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {mode?.icon} {mode?.name}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {playstyle?.icon} {playstyle?.name}
              </Badge>
            </div>
          </div>

          {/* Voting */}
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => voteMutation.mutate("up")}
              disabled={voteMutation.isPending}
              className="w-full hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30"
              data-testid="button-upvote"
            >
              <ThumbsUp className="w-4 h-4 mr-1.5" />
              {build.upvotes}
            </Button>
            <span
              className={`text-lg font-bold ${
                score > 0 ? "text-green-400" : score < 0 ? "text-red-400" : "text-muted-foreground"
              }`}
              data-testid="text-score"
            >
              {score > 0 ? "+" : ""}{score}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => voteMutation.mutate("down")}
              disabled={voteMutation.isPending}
              className="w-full hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
              data-testid="button-downvote"
            >
              <ThumbsDown className="w-4 h-4 mr-1.5" />
              {build.downvotes}
            </Button>
          </div>
        </div>

        {/* Description */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-foreground leading-relaxed" data-testid="text-description">
            {build.description}
          </p>
        </div>

        {/* Skills */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Main Skills
          </h3>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                <Swords className="w-3 h-3 mr-1" />
                {skill}
              </Badge>
            ))}
          </div>
        </div>

        {/* Meta info */}
        <div className="pt-4 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {build.author}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {season?.name}
          </span>
          {build.guideUrl && (
            <a
              href={build.guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
              data-testid="link-guide"
            >
              <ExternalLink className="w-3 h-3" />
              View Guide
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
