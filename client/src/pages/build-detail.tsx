import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTierVotes } from "@/hooks/use-tier-votes";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAuth } from "@/hooks/use-auth";
import { PLAYSTYLES, SOURCE_CONFIG, getKarmaColor, getKarmaTitle, TIER_CONFIG, TIER_VOTE_CONFIG } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ExternalLink, Calendar, User, Star, Bookmark, Flag, LogIn } from "lucide-react";
import type { BuildWithSubmitter } from "@shared/schema";

const TIER_ORDER = ["S+", "S", "A", "B", "C", "D"] as const;

type VoteDistribution = Record<string, number> & { total: number; median: string };

export default function BuildDetailPage() {
  const [, params] = useRoute("/build/:id");
  const buildId = params?.id ? parseInt(params.id) : 0;
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();

  // Report dialog state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [reportDetail, setReportDetail] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const { data: build, isLoading } = useQuery<BuildWithSubmitter>({
    queryKey: ["/api/builds", buildId],
    queryFn: async () => { const res = await apiRequest("GET", `/api/builds/${buildId}`); return res.json(); },
    enabled: buildId > 0,
  });

  const { data: distribution, isLoading: distLoading } = useQuery<VoteDistribution>({
    queryKey: [`/api/builds/${buildId}/vote-distribution`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/builds/${buildId}/vote-distribution`);
      return res.json();
    },
    enabled: buildId > 0,
    staleTime: 10_000,
  });

  const { getMyVote, castVote, isPending } = useTierVotes([["/api/builds", buildId], [`/api/builds/${buildId}/vote-distribution`]]);
  const { isBookmarked, toggleBookmark } = useBookmarks([["/api/builds", buildId]]);
  const myVote = build ? getMyVote(build.id) : null;
  const bookmarked = build ? isBookmarked(build.id) : false;

  const reportMutation = useMutation({
    mutationFn: async () => {
      const fullReason = reportDetail ? `${reportReason}: ${reportDetail}` : reportReason;
      await apiRequest("POST", `/api/builds/${buildId}/report`, { reason: fullReason });
    },
    onSuccess: () => {
      setReportSent(true);
      setReportOpen(false);
      toast({ title: "Build reported", description: "Thank you for flagging this build." });
      queryClient.invalidateQueries({ queryKey: ["/api/builds", buildId] });
    },
    onError: () => {
      toast({ title: "Failed to report", variant: "destructive" });
    },
  });

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
  const thumbnailUrl = (build as any).thumbnailUrl as string | null | undefined;
  const calculatedTier = build.calculatedTier || "N";
  const tierConfig = TIER_CONFIG[calculatedTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.N;

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

  // Distribution bar max for scaling
  const maxVotes = distribution ? Math.max(...TIER_ORDER.map(t => distribution[t] ?? 0), 1) : 1;
  const totalVotes = distribution?.total ?? build.tierVoteCount ?? 0;

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

      {/* Thumbnail hero */}
      {thumbnailUrl && (
        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={thumbnailUrl}
            alt={build.name}
            className="w-full h-48 object-cover"
            data-testid="img-build-hero"
            onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
          />
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
        {/* Header row: title + tier badge */}
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              {/* Tier badge */}
              <span
                className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-lg font-bold border ${tierConfig.color} shrink-0`}
                data-testid="badge-calculated-tier"
              >
                {calculatedTier}
              </span>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="text-build-name">
                {build.name}
              </h1>
            </div>
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

        {/* Engagement text highlight — bigger, not italic */}
        {engagementText && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-4" data-testid="text-engagement-quote">
            <p className="text-base text-primary leading-relaxed font-medium">"{engagementText}"</p>
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

        {/* ✅ Why Play / ⚠️ Things to Consider */}
        {(pros.length > 0 || cons.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pros.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-2">✅ Why Play This Build</p>
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
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">⚠️ Things to Consider</p>
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

        {/* 📊 Community Rating section */}
        <div className="border-t border-border pt-5 space-y-4" data-testid="section-community-rating">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">📊 Community Rating</p>

          {/* YOUR VOTE row */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Your Rating:</p>
            <div className="flex items-center gap-1.5 flex-wrap" data-testid="tier-vote-buttons-detail">
              {TIER_ORDER.map(t => {
                const cfg = TIER_VOTE_CONFIG[t];
                const isActive = myVote === t;
                const tc = TIER_CONFIG[t as keyof typeof TIER_CONFIG];
                return (
                  <button
                    key={t}
                    onClick={() => castVote(build.id, t)}
                    disabled={isPending}
                    title={`Vote ${t} tier — ${tc?.description ?? ""}`}
                    data-testid={`button-tier-vote-${t}`}
                    className={`
                      inline-flex items-center justify-center
                      px-3 py-1.5 rounded-md text-sm font-bold
                      border transition-all
                      ${isActive
                        ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder} scale-110 shadow-md`
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
            {myVote && (
              <p className="text-xs text-muted-foreground">
                You rated this <span className={`font-bold ${(TIER_CONFIG[myVote as keyof typeof TIER_CONFIG] || TIER_CONFIG.N).textColor}`}>{myVote}</span>
                {" "}· <button className="text-primary hover:underline" onClick={() => castVote(build.id, myVote)}>Remove</button>
              </p>
            )}
          </div>

          {/* Community median summary */}
          {totalVotes > 0 ? (
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold ${tierConfig.textColor}`} data-testid="text-community-tier">
                {calculatedTier}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{tierConfig.description} tier</p>
                <p className="text-xs text-muted-foreground">{totalVotes} vote{totalVotes === 1 ? "" : "s"} · community median</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No votes yet — be the first to rate this build!</p>
          )}

          {/* Distribution bars */}
          {!distLoading && distribution && totalVotes > 0 && (
            <div className="space-y-1.5" data-testid="vote-distribution">
              {TIER_ORDER.map(t => {
                const count = distribution[t] ?? 0;
                const pct = maxVotes > 0 ? (count / maxVotes) * 100 : 0;
                const tc = TIER_CONFIG[t as keyof typeof TIER_CONFIG];
                const isMedian = t === calculatedTier;
                return (
                  <div key={t} className="flex items-center gap-2">
                    <span className={`w-6 text-xs font-bold text-right shrink-0 ${tc?.textColor}`}>{t}</span>
                    <div className="flex-1 h-4 bg-secondary rounded-sm overflow-hidden">
                      <div
                        className={`h-full rounded-sm transition-all ${isMedian ? tc?.bgAccent : "bg-muted-foreground/30"}`}
                        style={{ width: `${pct}%` }}
                        data-testid={`bar-tier-${t}`}
                      />
                    </div>
                    <span className={`text-xs tabular-nums w-8 shrink-0 ${count > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
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

        {/* Save + Report actions */}
        {isLoggedIn ? (
          <div className="flex gap-3 pt-1 border-t border-border">
            <Button
              variant={bookmarked ? "default" : "outline"}
              size="sm"
              onClick={() => toggleBookmark(build.id)}
              className="flex-1 gap-2"
              data-testid="button-save-build"
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-current" : ""}`} />
              {bookmarked ? "Saved" : "Save Build"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportOpen(true)}
              disabled={reportSent}
              className={`flex-1 gap-2 ${reportSent ? "text-red-400 border-red-400/50" : "hover:text-red-400 hover:border-red-400/50"}`}
              data-testid="button-report-build"
            >
              <Flag className="w-4 h-4" />
              {reportSent ? "Reported" : "Report"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-border">
            <LogIn className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              <span
                className="text-primary cursor-pointer hover:underline"
                data-testid="link-signin-to-save"
                onClick={() => {
                  const btn = document.querySelector('[data-testid="button-login"]') as HTMLElement;
                  btn?.click();
                }}
              >
                Sign in
              </span>
              {" "}to save & report builds
            </p>
          </div>
        )}
      </div>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Report Build</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger data-testid="select-report-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                  <SelectItem value="spam">Spam or self-promotion</SelectItem>
                  <SelectItem value="wrong-game">Wrong game</SelectItem>
                  <SelectItem value="outdated">Outdated / no longer valid</SelectItem>
                  <SelectItem value="duplicate">Duplicate build</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Additional details <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="Describe the issue..."
                value={reportDetail}
                onChange={e => setReportDetail(e.target.value)}
                rows={3}
                data-testid="input-report-detail"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}
              data-testid="button-submit-report"
            >
              {reportMutation.isPending ? "Reporting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
