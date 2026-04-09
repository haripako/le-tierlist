import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Twitter, Instagram, Youtube, CheckCircle2, Trash2, RotateCcw, Copy,
  Sparkles, Clock, CheckCheck, Zap, Plus, Edit2, Bot, ExternalLink, Users
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
    case "youtube_shorts":
    case "youtube": return <Youtube className="w-3.5 h-3.5" />;
    default: return <Sparkles className="w-3.5 h-3.5" />;
  }
}

function getPlatformLabel(platform: string): string {
  switch (platform) {
    case "twitter": return "Twitter/X";
    case "instagram": return "Instagram";
    case "tiktok": return "TikTok";
    case "youtube_shorts": return "YouTube Shorts";
    case "youtube": return "YouTube";
    default: return platform;
  }
}

function getPlatformColor(platform: string): string {
  switch (platform) {
    case "twitter": return "text-sky-400 bg-sky-400/10 border-sky-400/20";
    case "instagram": return "text-pink-400 bg-pink-400/10 border-pink-400/20";
    case "tiktok": return "text-white bg-white/10 border-white/20";
    case "youtube_shorts":
    case "youtube": return "text-red-400 bg-red-400/10 border-red-400/20";
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
  pros?: string;
  cons?: string;
  difficulty?: string;
  budgetLevel?: string;
  guideUrl?: string;
};

type SocialAccount = {
  id: number;
  platform: string;
  accountName: string;
  accountUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

function generateAIPrompt(post: SocialPostEnriched): string {
  const platformName = getPlatformLabel(post.platform);
  const charLimit = post.platform === "twitter" ? "280 characters" : post.platform === "instagram" ? "2200 characters" : "no strict limit";
  const hashtags = post.platform === "instagram" ? "Include up to 30 relevant hashtags." : post.platform === "twitter" ? "Include 2-3 hashtags max." : "Include relevant hashtags.";

  let prosText = "";
  if (post.pros) {
    try {
      const parsed = JSON.parse(post.pros);
      if (Array.isArray(parsed)) prosText = parsed.map((p: string) => `- ${p}`).join("\n");
    } catch { prosText = post.pros; }
  }

  let consText = "";
  if (post.cons) {
    try {
      const parsed = JSON.parse(post.cons);
      if (Array.isArray(parsed)) consText = parsed.map((c: string) => `- ${c}`).join("\n");
    } catch { consText = post.cons; }
  }

  return `You are a gaming social media manager for BuildTier, a community-ranked build tier list platform for ARPGs.

Generate an engaging ${platformName} post for this build:

Build: ${post.buildName}
Game: ${post.gameName}
Class: ${post.className}${post.mastery ? ` / ${post.mastery}` : ""}
Tier: ${post.tierLabel ?? "Rated by community"}
Guide Source: ${post.guideUrl ?? "BuildTier.gg"}
${prosText ? `\nStrengths:\n${prosText}` : ""}${consText ? `\n\nWeaknesses:\n${consText}` : ""}${post.difficulty ? `\n\nDifficulty: ${post.difficulty}` : ""}${post.budgetLevel ? `\nBudget: ${post.budgetLevel}` : ""}

Requirements:
- Write in an enthusiastic but authentic gaming voice
- ${hashtags}
- Include a call to action to visit BuildTier
- Keep within ${charLimit}
- Make it feel like it was written by a real gamer, not AI
- Reference the specific tier rating and what makes this build strong`;
}

const EMPTY_ACCOUNT_FORM = { platform: "twitter", accountName: "", accountUrl: "", isActive: true };

export default function AdminSocialPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [aiPromptPost, setAiPromptPost] = useState<SocialPostEnriched | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [mainTab, setMainTab] = useState("queue");

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

  const { data: accounts, isLoading: accountsLoading } = useQuery<SocialAccount[]>({
    queryKey: ["/api/admin/social-accounts", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/social-accounts?adminUserId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const markPostedMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/social-queue/${id}/posted`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] }); toast({ title: "Marked as posted" }); },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/social-queue/${id}/approve`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] }); toast({ title: "Post approved" }); },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/social-queue/${id}`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] }); toast({ title: "Post dismissed" }); },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (buildId: number) => {
      const res = await apiRequest("POST", `/api/admin/social-queue/regenerate/${buildId}`, { adminUserId: user?.id });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/social-queue"] }); toast({ title: "Content regenerated for all platforms" }); },
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

  // Social account mutations
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/social-accounts", {
        adminUserId: user?.id,
        platform: accountForm.platform,
        accountName: accountForm.accountName,
        accountUrl: accountForm.accountUrl || null,
        isActive: accountForm.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-accounts"] });
      toast({ title: "Account added" });
      setAccountDialogOpen(false);
      setAccountForm(EMPTY_ACCOUNT_FORM);
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async () => {
      if (!editingAccount) return;
      const res = await apiRequest("PATCH", `/api/admin/social-accounts/${editingAccount.id}`, {
        adminUserId: user?.id,
        platform: accountForm.platform,
        accountName: accountForm.accountName,
        accountUrl: accountForm.accountUrl || null,
        isActive: accountForm.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-accounts"] });
      toast({ title: "Account updated" });
      setAccountDialogOpen(false);
      setEditingAccount(null);
      setAccountForm(EMPTY_ACCOUNT_FORM);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/social-accounts/${id}?adminUserId=${user?.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/social-accounts"] });
      toast({ title: "Account removed" });
    },
  });

  const handleCopyContent = async (post: SocialPostEnriched) => {
    try {
      await navigator.clipboard.writeText(post.content);
      setCopiedId(post.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Copied to clipboard" });
    } catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  const handleCopyHashtags = async (post: SocialPostEnriched) => {
    try {
      await navigator.clipboard.writeText(post.hashtags);
      toast({ title: "Hashtags copied" });
    } catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  const handleCopyPrompt = async () => {
    if (!aiPromptPost) return;
    try {
      await navigator.clipboard.writeText(generateAIPrompt(aiPromptPost));
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
      toast({ title: "Prompt copied" });
    } catch { toast({ title: "Copy failed", variant: "destructive" }); }
  };

  const getTwitterComposeUrl = (content: string) => {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(content.slice(0, 280))}`;
  };

  const openAddAccount = () => {
    setEditingAccount(null);
    setAccountForm(EMPTY_ACCOUNT_FORM);
    setAccountDialogOpen(true);
  };

  const openEditAccount = (account: SocialAccount) => {
    setEditingAccount(account);
    setAccountForm({
      platform: account.platform,
      accountName: account.accountName,
      accountUrl: account.accountUrl ?? "",
      isActive: account.isActive,
    });
    setAccountDialogOpen(true);
  };

  return (
    <AdminLayout title="Social">
      <div className="space-y-5">
        {/* Main tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="queue" className="text-xs" data-testid="tab-social-queue">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Post Queue
            </TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs" data-testid="tab-social-accounts">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Accounts
            </TabsTrigger>
          </TabsList>

          {/* ── Queue tab ── */}
          <TabsContent value="queue" className="mt-4 space-y-5">
            {/* Filter row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList className="h-8">
                    <TabsTrigger value="pending" className="text-xs h-7" data-testid="tab-pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved" className="text-xs h-7" data-testid="tab-approved">Approved</TabsTrigger>
                    <TabsTrigger value="posted" className="text-xs h-7" data-testid="tab-posted">Posted</TabsTrigger>
                    <TabsTrigger value="all" className="text-xs h-7" data-testid="tab-all">All</TabsTrigger>
                  </TabsList>
                </Tabs>

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

            {!isLoading && posts && (
              <p className="text-xs text-muted-foreground">
                {posts.length} post{posts.length !== 1 ? "s" : ""} · {statusFilter !== "all" ? statusFilter : "all statuses"}
              </p>
            )}

            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
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
                      <p className="text-xs font-semibold text-primary mb-2 italic">"{post.hookLine}"</p>

                      <pre
                        className="text-xs text-muted-foreground font-sans whitespace-pre-wrap leading-relaxed bg-background/50 rounded-md p-3 border border-border/30 max-h-40 overflow-y-auto"
                        data-testid={`text-post-content-${post.id}`}
                      >
                        {post.content}
                      </pre>

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
                          <Copy className="w-3 h-3 mr-1" />Tags
                        </Button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border/50 bg-background/30 flex-wrap">
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

                      {/* AI Prompt button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5 border-purple-400/30 text-purple-400 hover:bg-purple-400/10"
                        onClick={() => setAiPromptPost(post)}
                        data-testid={`button-ai-prompt-${post.id}`}
                      >
                        <Bot className="w-3 h-3" /> AI Prompt
                      </Button>

                      {/* Twitter compose link */}
                      {post.platform === "twitter" && (
                        <a
                          href={getTwitterComposeUrl(post.content)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs border border-sky-400/30 text-sky-400 hover:bg-sky-400/10 transition-colors"
                          data-testid={`link-twitter-compose-${post.id}`}
                        >
                          <ExternalLink className="w-3 h-3" /> Post on X
                        </a>
                      )}

                      {post.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5 border-blue-400/30 text-blue-400 hover:bg-blue-400/10"
                          onClick={() => approveMutation.mutate(post.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${post.id}`}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
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
                          <CheckCheck className="w-3 h-3" /> Mark Posted
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
                        <RotateCcw className="w-3 h-3" /> Regen
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => dismissMutation.mutate(post.id)}
                        disabled={dismissMutation.isPending}
                        data-testid={`button-dismiss-${post.id}`}
                      >
                        <Trash2 className="w-3 h-3" /> Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Accounts tab ── */}
          <TabsContent value="accounts" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Social media accounts used for BuildTier.</p>
              <Button size="sm" onClick={openAddAccount} className="gap-1.5" data-testid="button-add-account">
                <Plus className="w-3.5 h-3.5" /> Add Account
              </Button>
            </div>

            {accountsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : accounts?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">No accounts configured</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts?.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                    data-testid={`account-row-${account.id}`}
                  >
                    <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border shrink-0 ${getPlatformColor(account.platform)}`}>
                      {getPlatformIcon(account.platform)}
                      {getPlatformLabel(account.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{account.accountName}</p>
                      {account.accountUrl && (
                        <a
                          href={account.accountUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-1"
                        >
                          <ExternalLink className="w-2.5 h-2.5" /> {account.accountUrl}
                        </a>
                      )}
                    </div>
                    {!account.isActive && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Inactive</Badge>
                    )}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => openEditAccount(account)}
                        data-testid={`button-edit-account-${account.id}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteAccountMutation.mutate(account.id)}
                        data-testid={`button-delete-account-${account.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Prompt Modal */}
      <Dialog open={!!aiPromptPost} onOpenChange={open => { if (!open) setAiPromptPost(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              AI Prompt Generator
            </DialogTitle>
          </DialogHeader>
          {aiPromptPost && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border ${getPlatformColor(aiPromptPost.platform)}`}>
                  {getPlatformIcon(aiPromptPost.platform)}
                  {getPlatformLabel(aiPromptPost.platform)}
                </div>
                <span className="text-xs text-muted-foreground">
                  {aiPromptPost.buildName} · {aiPromptPost.gameName}
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Prompt</Label>
                <pre className="text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed bg-background rounded-md p-4 border border-border max-h-64 overflow-y-auto">
                  {generateAIPrompt(aiPromptPost)}
                </pre>
              </div>

              <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Platform notes:</p>
                {aiPromptPost.platform === "twitter" && <p>• 280 character limit — be punchy and direct</p>}
                {aiPromptPost.platform === "instagram" && <p>• Up to 30 hashtags recommended · 2200 char limit · hook in first line</p>}
                {aiPromptPost.platform === "tiktok" && <p>• Conversational tone · trending audio references help · short hooks</p>}
                {aiPromptPost.platform === "youtube_shorts" && <p>• Script for 60-second video · strong opening hook · clear CTA at end</p>}
                <p>• Paste this prompt into ChatGPT, Claude, or Gemini</p>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-1.5"
                  onClick={handleCopyPrompt}
                  data-testid="button-copy-prompt"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedPrompt ? "Copied!" : "Copy Prompt"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handleCopyContent(aiPromptPost)}
                  data-testid="button-copy-post-content"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Post
                </Button>
                {aiPromptPost.platform === "twitter" && (
                  <a
                    href={getTwitterComposeUrl(aiPromptPost.content)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm border border-sky-400/30 text-sky-400 hover:bg-sky-400/10 transition-colors"
                    data-testid="link-ai-modal-twitter"
                  >
                    <Twitter className="w-3.5 h-3.5" /> Post on X
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Social Account Add/Edit Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={open => {
        setAccountDialogOpen(open);
        if (!open) { setEditingAccount(null); setAccountForm(EMPTY_ACCOUNT_FORM); }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edit Account" : "Add Social Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Platform *</Label>
              <Select value={accountForm.platform} onValueChange={v => setAccountForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger data-testid="select-account-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">Account Name *</Label>
              <Input
                id="account-name"
                placeholder="e.g. @BuildTier"
                value={accountForm.accountName}
                onChange={e => setAccountForm(f => ({ ...f, accountName: e.target.value }))}
                data-testid="input-account-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-url">Profile URL</Label>
              <Input
                id="account-url"
                placeholder="https://..."
                value={accountForm.accountUrl}
                onChange={e => setAccountForm(f => ({ ...f, accountUrl: e.target.value }))}
                data-testid="input-account-url"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={accountForm.isActive}
                onCheckedChange={v => setAccountForm(f => ({ ...f, isActive: v }))}
                data-testid="toggle-account-active"
              />
              <Label>Active</Label>
            </div>
            <Button
              className="w-full"
              onClick={() => editingAccount ? updateAccountMutation.mutate() : createAccountMutation.mutate()}
              disabled={!accountForm.accountName || createAccountMutation.isPending || updateAccountMutation.isPending}
              data-testid="button-save-account"
            >
              {editingAccount ? "Save Changes" : "Add Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
