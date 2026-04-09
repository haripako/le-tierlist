import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Twitter, Instagram, Youtube, CheckCircle2, Trash2, RotateCcw, Copy,
  Sparkles, Clock, CheckCheck, Zap
} from "lucide-react";

// Platform helpers
function getPlatformIcon(platform: string) {
  switch (platform) {
    case "twitter": return <Twitter className="w-3.5 h-3.5" />;
    case "instagram": return <Instagram className="w-3.5 h-3.5" />;
    case "tiktok": return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
      </svg>
    );
    case "youtube_shorts": return <Youtube className="w-3.5 h-3.5" />;
    default: return <Sparkles className="w-3.5 h-3.5" />;
  }
}

function getPlatformLabel(platform: string): string {
  switch (platform) {
    case "twitter": return "Twitter/X";
    case "instagram": return "Instagram";
    case "tiktok": return "TikTok";
    case "youtube_shorts": return "YouTube Shorts";
    default: return platform;
  }
}

function getPlatformColor(platform: string): string {
  switch (platform) {
    case "twitter": return "text-sky-400 bg-sky-400/10 border-sky-400/20";
    case "instagram": return "text-pink-400 bg-pink-400/10 border-pink-400/20";
    case "tiktok": return "text-white bg-white/10 border-white/20";
    case "youtube_shorts": return "text-red-400 bg-red-400/10 border-red-400/20";
    default: return "text-primary bg-primary/10 border-primary/20";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-yellow-400 border-yellow-400/40 bg-yellow-400/10 text-[10px]"><Clock className="w-2.5 h-2.5 mr-1" />Pending</Badge>;
    case "approved":
      return <Badge variant="outline" className="text-blue-400 border-blue-400/40 bg-blue-400/10 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Approved</Badge>;
    case "posted":
      return <Badge variant="outline" className="text-green-400 border-green-400/40 bg-green-400/10 text-[10px]"><CheckCheck className="w-2.5 h-2.5 mr-1" />Posted</Badge>;
    case "dismissed":
      return <Badge variant="outline" className="text-muted-foreground border-border text-[10px]">Dismissed</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

type SocialPostEnriched = {
  id: number;
  buildId: number;
  gameId: number;
  platform: string;
  content: string;
  hashtags: string;
  hookLine: string;
  tierLabel: string | null;
  status: string;
  createdAt: string;
  buildName: string;
  gameName: string;
  className: string;
  mastery: string;
  upvotes: number;
  downvotes: number;
};

export default function AdminSocialPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: posts, isLoading } = useQuery<SocialPostEnriched[]>({
    queryKey: ["/api/admin/social-queue", user?.id, statusFilter, platformFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ adminUserId: String(user?.id ?? "") });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (platformFilter !== "all") params.set("platform", platformFilter);
      const res = await apiRequest("GET", `/api/admin/social-queue?${params.toString()}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const markPostedMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/social-queue/${id}/posted`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] });
      toast({ title: "Marked as posted" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/social-queue/${id}/approve`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] });
      toast({ title: "Post approved" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/social-queue/${id}`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] });
      toast({ title: "Post dismissed" });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (buildId: number) => {
      const res = await apiRequest("POST", `/api/admin/social-queue/regenerate/${buildId}`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] });
      toast({ title: "Content regenerated for all platforms" });
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/social-queue/generate-all`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] });
      toast({ title: `Generated ${data.generated} social posts` });
    },
  });

  const handleCopyContent = async (post: SocialPostEnriched) => {
    try {
      await navigator.clipboard.writeText(post.content);
      setCopiedId(post.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleCopyHashtags = async (post: SocialPostEnriched) => {
    try {
      await navigator.clipboard.writeText(post.hashtags);
      toast({ title: "Hashtags copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <AdminLayout title="Social Queue">
      <div className="space-y-5">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status tabs */}
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="h-8">
                <TabsTrigger value="pending" className="text-xs h-7" data-testid="tab-pending">Pending</TabsTrigger>
                <TabsTrigger value="approved" className="text-xs h-7" data-testid="tab-approved">Approved</TabsTrigger>
                <TabsTrigger value="posted" className="text-xs h-7" data-testid="tab-posted">Posted</TabsTrigger>
                <TabsTrigger value="all" className="text-xs h-7" data-testid="tab-all">All</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Platform filter */}
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs" data-testid="select-platform">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="twitter">Twitter/X</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate all button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateAllMutation.mutate()}
            disabled={generateAllMutation.isPending}
            className="text-xs gap-1.5"
            data-testid="button-generate-all"
          >
            <Zap className="w-3.5 h-3.5 text-primary" />
            {generateAllMutation.isPending ? "Generating..." : "Generate All"}
          </Button>
        </div>

        {/* Post count */}
        {!isLoading && posts && (
          <p className="text-xs text-muted-foreground">
            {posts.length} post{posts.length !== 1 ? "s" : ""} · {statusFilter !== "all" ? statusFilter : "all statuses"}
          </p>
        )}

        {/* Posts grid */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
          </div>
        ) : posts?.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl" data-testid="empty-queue">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No posts in this queue</p>
            <p className="text-xs mt-1 opacity-70">
              {statusFilter === "pending"
                ? "Submit a new build or click \"Generate All\" to populate the queue."
                : "Change the filter to see other posts."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts?.map(post => (
              <div
                key={post.id}
                className="rounded-lg border border-border bg-card overflow-hidden"
                data-testid={`social-post-${post.id}`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50 bg-card/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Platform badge */}
                    <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border ${getPlatformColor(post.platform)}`}>
                      {getPlatformIcon(post.platform)}
                      {getPlatformLabel(post.platform)}
                    </div>
                    {getStatusBadge(post.status)}
                    {post.tierLabel && (
                      <Badge variant="secondary" className="text-[10px] font-bold text-primary">{post.tierLabel}</Badge>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-foreground truncate max-w-[160px]" data-testid={`text-post-build-${post.id}`}>{post.buildName}</p>
                    <p className="text-[10px] text-muted-foreground">{post.gameName} · {post.className}{post.mastery ? ` / ${post.mastery}` : ""}</p>
                  </div>
                </div>

                {/* Content area */}
                <div className="px-4 py-3">
                  {/* Hook line */}
                  <p className="text-xs font-semibold text-primary mb-2 italic">"{post.hookLine}"</p>

                  {/* Full content */}
                  <pre
                    className="text-xs text-muted-foreground font-sans whitespace-pre-wrap leading-relaxed bg-background/50 rounded-md p-3 border border-border/30 max-h-40 overflow-y-auto"
                    data-testid={`text-post-content-${post.id}`}
                  >
                    {post.content}
                  </pre>

                  {/* Hashtags */}
                  <div className="flex items-start gap-2 mt-2">
                    <p className="text-[10px] text-muted-foreground leading-relaxed flex-1 truncate" data-testid={`text-post-hashtags-${post.id}`}>
                      {post.hashtags.split(",").join(" ").slice(0, 100)}...
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] shrink-0"
                      onClick={() => handleCopyHashtags(post)}
                      data-testid={`button-copy-hashtags-${post.id}`}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Tags
                    </Button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-background/30">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => handleCopyContent(post)}
                    data-testid={`button-copy-content-${post.id}`}
                  >
                    <Copy className="w-3 h-3" />
                    {copiedId === post.id ? "Copied!" : "Copy"}
                  </Button>

                  {post.status === "pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-blue-400/30 text-blue-400 hover:bg-blue-400/10"
                      onClick={() => approveMutation.mutate(post.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-${post.id}`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Approve
                    </Button>
                  )}

                  {(post.status === "pending" || post.status === "approved") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-green-400/30 text-green-400 hover:bg-green-400/10"
                      onClick={() => markPostedMutation.mutate(post.id)}
                      disabled={markPostedMutation.isPending}
                      data-testid={`button-mark-posted-${post.id}`}
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark Posted
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground ml-auto"
                    onClick={() => regenerateMutation.mutate(post.buildId)}
                    disabled={regenerateMutation.isPending}
                    data-testid={`button-regenerate-${post.id}`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Regen
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => dismissMutation.mutate(post.id)}
                    disabled={dismissMutation.isPending}
                    data-testid={`button-dismiss-${post.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
