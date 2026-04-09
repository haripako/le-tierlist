import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CLASSES, GAME_MODES, PLAYSTYLES, SOURCE_CONFIG } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Send, ExternalLink, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import type { Season } from "@shared/schema";

function detectSourceClient(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    if (hostname.includes("lastepochtools.com")) return "lastepochtools";
    if (hostname.includes("maxroll.gg")) return "maxroll";
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("mobalytics.gg")) return "mobalytics";
    if (hostname.includes("reddit.com")) return "reddit";
    return "other";
  } catch { return "other"; }
}

export default function SubmitBuildPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isLoggedIn } = useAuth();

  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [mastery, setMastery] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [gameMode, setGameMode] = useState("softcore");
  const [playstyle, setPlaystyle] = useState("");
  const [description, setDescription] = useState("");
  const [mainSkills, setMainSkills] = useState("");
  const [guideUrl, setGuideUrl] = useState("");

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/seasons"); return res.json(); },
  });

  const activeSeasons = seasons?.filter(s => s.isActive) ?? [];
  const selectedClass = CLASSES.find(c => c.id === className);
  const availableMasteries = selectedClass?.masteries ?? [];
  const detectedSource = useMemo(() => guideUrl ? detectSourceClient(guideUrl) : null, [guideUrl]);
  const sourceInfo = detectedSource ? SOURCE_CONFIG[detectedSource] : null;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const skillsArray = mainSkills.split(",").map(s => s.trim()).filter(Boolean);
      const res = await apiRequest("POST", "/api/builds", {
        name,
        className,
        mastery,
        seasonId: parseInt(seasonId),
        gameMode,
        playstyle,
        description,
        mainSkills: JSON.stringify(skillsArray),
        guideUrl,
        submitterId: user!.id,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tier-list"] });
      toast({ title: "Build submitted", description: "Your build has been added. Earn karma as people vote on it." });
      navigate("/");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-semibold">Sign in to submit builds</h2>
        <p className="text-sm text-muted-foreground">You need an account to submit builds and earn karma from community votes.</p>
      </div>
    );
  }

  const isValid = name && className && mastery && seasonId && gameMode && playstyle && description && mainSkills && guideUrl;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="text-submit-title">
          Submit a Build Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share a link to a build guide from YouTube, Maxroll, Last Epoch Tools, or any other source. You'll earn karma when people upvote it.
        </p>
      </div>

      <div className="space-y-4 bg-card border border-border rounded-lg p-6">
        {/* Guide URL — first and prominent */}
        <div className="space-y-2">
          <Label htmlFor="guide" className="text-sm font-semibold">Build Guide URL</Label>
          <div className="relative">
            <Input
              id="guide"
              placeholder="https://www.youtube.com/watch?v=... or https://maxroll.gg/..."
              value={guideUrl}
              onChange={e => setGuideUrl(e.target.value)}
              className="pr-24"
              data-testid="input-guide-url"
            />
            {sourceInfo && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs flex items-center gap-1 ${sourceInfo.color}`}>
                {sourceInfo.icon} {sourceInfo.name}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Supported: YouTube, Maxroll, Last Epoch Tools, Mobalytics, Reddit, or any URL
          </p>
        </div>

        {/* Build Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Build Name</Label>
          <Input id="name" placeholder="e.g., Lightning Smite Paladin" value={name} onChange={e => setName(e.target.value)} data-testid="input-name" />
        </div>

        {/* Class + Mastery */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <Select value={className} onValueChange={v => { setClassName(v); setMastery(""); }}>
              <SelectTrigger data-testid="select-class"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mastery</Label>
            <Select value={mastery} onValueChange={setMastery} disabled={!className}>
              <SelectTrigger data-testid="select-mastery"><SelectValue placeholder="Select mastery" /></SelectTrigger>
              <SelectContent>
                {availableMasteries.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Season + Mode + Playstyle */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Season</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger data-testid="select-season"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {activeSeasons.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Game Mode</Label>
            <Select value={gameMode} onValueChange={setGameMode}>
              <SelectTrigger data-testid="select-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GAME_MODES.map(m => <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Playstyle</Label>
            <Select value={playstyle} onValueChange={setPlaystyle}>
              <SelectTrigger data-testid="select-playstyle"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {PLAYSTYLES.map(p => <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" placeholder="Brief description of the build, its strengths, and playstyle..." value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-description" />
        </div>

        {/* Main Skills */}
        <div className="space-y-2">
          <Label htmlFor="skills">Main Skills (comma-separated)</Label>
          <Input id="skills" placeholder="e.g., Smite, Hammer Throw, Holy Aura, Lunge, Sigils of Hope" value={mainSkills} onChange={e => setMainSkills(e.target.value)} data-testid="input-skills" />
        </div>

        <Button onClick={() => submitMutation.mutate()} disabled={!isValid || submitMutation.isPending} className="w-full" data-testid="button-submit">
          <Send className="w-4 h-4 mr-2" />
          {submitMutation.isPending ? "Submitting..." : "Submit Build Guide"}
        </Button>
      </div>
    </div>
  );
}
