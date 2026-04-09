import { useState, useMemo, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PLAYSTYLES, SOURCE_CONFIG, detectSourceClient } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Send, ExternalLink, Loader2, Sparkles, ChevronRight, Link as LinkIcon, ArrowLeft, Gamepad2 } from "lucide-react";
import type { GameWithMeta, GameClass, Season, GameMode } from "@shared/schema";

type ExtractedBuild = {
  name: string;
  className: string;
  mastery: string;
  playstyle: string;
  description: string;
  mainSkills: string[];
  sourceType: string;
  confidence: "high" | "medium" | "low";
  pros?: string[];
  cons?: string[];
  engagementText?: string;
  difficulty?: "beginner" | "intermediate" | "advanced" | "expert";
  budgetLevel?: "budget" | "mid-range" | "expensive" | "endgame";
  thumbnailUrl?: string;
};

export default function SubmitBuildPage() {
  const [, navigate] = useLocation();
  const [matchSubmitSlug, paramsSubmitSlug] = useRoute("/submit/:gameSlug");
  const { toast } = useToast();
  const { user, isLoggedIn } = useAuth();

  // Read game slug from hash route param: /submit/diablo-4
  const preselectedGame = matchSubmitSlug ? (paramsSubmitSlug?.gameSlug ?? "") : "";

  // Steps: "game" | "url" | "edit"
  const [step, setStep] = useState<"game" | "url" | "edit">(preselectedGame ? "url" : "game");

  // Game selection
  const [selectedGameSlug, setSelectedGameSlug] = useState(preselectedGame);

  // URL step
  const [guideUrl, setGuideUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // Edit step fields
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [mastery, setMastery] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [gameModeId, setGameModeId] = useState("");
  const [playstyle, setPlaystyle] = useState("");
  const [description, setDescription] = useState("");
  const [mainSkills, setMainSkills] = useState("");
  const [extractConfidence, setExtractConfidence] = useState("");
  // Rich content fields
  const [engagementText, setEngagementText] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [budgetLevel, setBudgetLevel] = useState("");
  const [prosText, setProsText] = useState(""); // comma-separated
  const [consText, setConsText] = useState(""); // comma-separated
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");

  // Fetch all games for game picker
  const { data: games } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/games"); return res.json(); },
  });

  // Fetch selected game info (classes + seasons + modes)
  const { data: selectedGame } = useQuery<GameWithMeta>({
    queryKey: ["/api/games", selectedGameSlug],
    queryFn: async () => { const res = await apiRequest("GET", `/api/games/${selectedGameSlug}`); return res.json(); },
    enabled: !!selectedGameSlug,
  });

  const classes: GameClass[] = selectedGame?.classes ?? [];
  const activeSeasons: Season[] = selectedGame?.activeSeasons ?? [];
  const gameModes: GameMode[] = selectedGame?.modes ?? [];
  const selectedClassObj = classes.find(c => c.name === className);
  const availableMasteries: string[] = selectedClassObj
    ? (() => { try { return JSON.parse(selectedClassObj.masteries); } catch { return []; } })()
    : [];

  const detectedSource = useMemo(() => guideUrl ? detectSourceClient(guideUrl) : null, [guideUrl]);
  const sourceInfo = detectedSource ? SOURCE_CONFIG[detectedSource] : null;

  const isValidUrl = useMemo(() => {
    try { new URL(guideUrl); return true; } catch { return false; }
  }, [guideUrl]);

  // Set default game mode to first mode's ID
  useEffect(() => {
    if (gameModes.length > 0 && !gameModeId) {
      const defaultMode = gameModes.find(m => m.isDefault) ?? gameModes[0];
      setGameModeId(String(defaultMode.id));
    }
  }, [gameModes]);

  // Reset game mode when game changes
  useEffect(() => {
    setGameModeId("");
  }, [selectedGameSlug]);

  // Auto-set season if only one active
  useEffect(() => {
    if (activeSeasons.length > 0 && !seasonId) {
      setSeasonId(String(activeSeasons[0].id));
    }
  }, [activeSeasons, seasonId]);

  const handleExtract = async () => {
    if (!isValidUrl) return;
    setIsExtracting(true);
    try {
      const res = await apiRequest("POST", "/api/extract-build", { url: guideUrl });
      const data: ExtractedBuild = await res.json();
      if (data.name) setName(data.name);
      if (data.className) setClassName(data.className);
      if (data.mastery) setMastery(data.mastery);
      if (data.playstyle) setPlaystyle(data.playstyle);
      if (data.description) setDescription(data.description);
      if (data.mainSkills?.length) setMainSkills(data.mainSkills.join(", "));
      if (data.engagementText) setEngagementText(data.engagementText);
      if (data.difficulty) setDifficulty(data.difficulty);
      if (data.budgetLevel) setBudgetLevel(data.budgetLevel);
      if (data.pros?.length) setProsText(data.pros.join(", "));
      if (data.cons?.length) setConsText(data.cons.join(", "));
      if (data.thumbnailUrl) setThumbnailUrl(data.thumbnailUrl);
      setExtractConfidence(data.confidence);
      setStep("edit");
    } catch {
      toast({ title: "Extraction failed", description: "Could not read the URL. You can still fill in the details manually.", variant: "destructive" });
      setStep("edit");
    } finally {
      setIsExtracting(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const skillsArray = mainSkills.split(",").map(s => s.trim()).filter(Boolean);
      const prosArray = prosText.split(",").map(s => s.trim()).filter(Boolean);
      const consArray = consText.split(",").map(s => s.trim()).filter(Boolean);
      const res = await apiRequest("POST", "/api/builds", {
        gameId: selectedGame?.id,
        name,
        className,
        mastery,
        seasonId: seasonId ? parseInt(seasonId) : null,
        gameModeId: gameModeId ? parseInt(gameModeId) : null,
        playstyle,
        description,
        mainSkills: JSON.stringify(skillsArray),
        guideUrl,
        submitterId: user?.id || null,
        engagementText: engagementText || null,
        difficulty: difficulty || null,
        budgetLevel: budgetLevel || null,
        pros: prosArray.length > 0 ? JSON.stringify(prosArray) : null,
        cons: consArray.length > 0 ? JSON.stringify(consArray) : null,
        thumbnailUrl: thumbnailUrl || null,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Build submitted!", description: isLoggedIn ? "Earn karma as people vote on it." : "Your build is now live." });
      if (selectedGameSlug) navigate(`/game/${selectedGameSlug}`);
      else navigate("/");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const isValid = name && className && gameModeId && playstyle && guideUrl && selectedGame;

  const CATEGORY_ORDER = ["arpg", "looter-shooter", "mmo", "other"];
  const grouped: Record<string, GameWithMeta[]> = {};
  for (const g of (games ?? [])) {
    if (!grouped[g.category]) grouped[g.category] = [];
    grouped[g.category].push(g);
  }

  const categoryLabels: Record<string, string> = { arpg: "ARPG", "looter-shooter": "Looter-Shooter", mmo: "MMO", other: "Other" };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="text-submit-title">
          Submit a Build
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share a build guide from any source and help the community find great builds.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${step === "game" ? "bg-primary/10 text-primary font-medium" : "bg-secondary"}`}>
          <Gamepad2 className="w-3 h-3" /> Select Game
        </span>
        <ChevronRight className="w-3 h-3" />
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${step === "url" ? "bg-primary/10 text-primary font-medium" : "bg-secondary"}`}>
          <LinkIcon className="w-3 h-3" /> Paste URL
        </span>
        <ChevronRight className="w-3 h-3" />
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${step === "edit" ? "bg-primary/10 text-primary font-medium" : "bg-secondary"}`}>
          <Sparkles className="w-3 h-3" /> Review & Submit
        </span>
      </div>

      {/* ─── Step 0: Pick Game ─── */}
      {step === "game" && (
        <div className="space-y-4">
          {CATEGORY_ORDER.map(cat => {
            const catGames = grouped[cat];
            if (!catGames?.length) return null;
            return (
              <div key={cat} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{categoryLabels[cat]}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {catGames.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { setSelectedGameSlug(g.slug); setStep("url"); }}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all text-left group"
                      data-testid={`button-select-game-${g.slug}`}
                    >
                      {(g as any).logoUrl ? (
                        <img src={(g as any).logoUrl} alt={g.name} className="w-6 h-6 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                      ) : (
                        <span className="text-xl">{g.icon}</span>
                      )}
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{g.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Step 1: Paste URL ─── */}
      {step === "url" && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          {selectedGame && (
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <button onClick={() => setStep("game")} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              {(selectedGame as any).logoUrl ? (
                <img src={(selectedGame as any).logoUrl} alt={selectedGame.name} className="w-6 h-6 object-contain" />
              ) : (
                <span className="text-xl">{selectedGame.icon}</span>
              )}
              <span className="text-sm font-semibold text-foreground">{selectedGame.name}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="guide" className="text-sm font-semibold">Build Guide URL</Label>
            <div className="relative">
              <Input
                id="guide"
                placeholder="https://youtube.com/... or https://maxroll.gg/..."
                value={guideUrl}
                onChange={e => setGuideUrl(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && isValidUrl) handleExtract(); }}
                className="pr-24 text-base h-12"
                autoFocus
                data-testid="input-guide-url"
              />
              {sourceInfo && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs flex items-center gap-1 ${sourceInfo.color}`}>
                  {sourceInfo.icon} {sourceInfo.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">Supported: YouTube, Maxroll, Icy Veins, Mobalytics, Fextralife, Reddit, and more</p>
          </div>

          <Button onClick={handleExtract} disabled={!isValidUrl || isExtracting} className="w-full h-11" data-testid="button-extract">
            {isExtracting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading the page…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Auto-fill from URL</>
            )}
          </Button>
          <button onClick={() => setStep("edit")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
            Skip and fill in manually
          </button>
        </div>
      )}

      {/* ─── Step 2: Review & Edit ─── */}
      {step === "edit" && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <button onClick={() => setStep("url")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            {selectedGame && (
              <>
                {(selectedGame as any).logoUrl ? (
                  <img src={(selectedGame as any).logoUrl} alt={selectedGame.name} className="w-6 h-6 object-contain" />
                ) : (
                  <span className="text-xl">{selectedGame.icon}</span>
                )}
                <span className="text-sm font-semibold text-foreground">{selectedGame.name}</span>
              </>
            )}
            {extractConfidence && (
              <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full ${
                extractConfidence === "high" ? "bg-green-500/20 text-green-400" :
                extractConfidence === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              }`}>
                {extractConfidence} confidence
              </span>
            )}
          </div>

          {/* Guide URL summary */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
            <ExternalLink className="w-3 h-3 shrink-0" />
            <a href={guideUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary">{guideUrl}</a>
          </div>

          {/* Thumbnail preview */}
          {thumbnailUrl && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card" data-testid="thumbnail-preview">
              <img
                src={thumbnailUrl}
                alt="Thumbnail"
                className="w-20 h-14 rounded object-cover border border-border shrink-0"
                onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Thumbnail extracted from URL</p>
              </div>
              <button
                onClick={() => setThumbnailUrl("")}
                className="text-muted-foreground hover:text-foreground text-xs shrink-0"
                data-testid="button-remove-thumbnail"
              >
                Remove
              </button>
            </div>
          )}

          {/* Build Name */}
          <div className="space-y-2">
            <Label htmlFor="build-name" className="text-sm font-semibold">Build Name *</Label>
            <Input id="build-name" placeholder="e.g. Smite Hammerdin" value={name} onChange={e => setName(e.target.value)} data-testid="input-build-name" />
          </div>

          {/* Class + Mastery */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Class *</Label>
              <Select value={className} onValueChange={v => { setClassName(v); setMastery(""); }}>
                <SelectTrigger data-testid="select-class">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.length > 0
                    ? classes.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)
                    : <SelectItem value="other">Other</SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>
            {availableMasteries.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Mastery</Label>
                <Select value={mastery} onValueChange={setMastery}>
                  <SelectTrigger data-testid="select-mastery">
                    <SelectValue placeholder="Select mastery" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMasteries.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Season + Game Mode */}
          <div className="grid grid-cols-2 gap-3">
            {/* Season selector — only for games with hasSeasons */}
            {selectedGame?.hasSeasons && activeSeasons.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Season</Label>
                <Select value={seasonId} onValueChange={setSeasonId}>
                  <SelectTrigger data-testid="select-season">
                    <SelectValue placeholder="Season" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No season</SelectItem>
                    {activeSeasons.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Game Mode selector — dynamic per game */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Game Mode *</Label>
              <Select value={gameModeId} onValueChange={setGameModeId}>
                <SelectTrigger data-testid="select-game-mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {gameModes.length > 0
                    ? gameModes.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)
                    : <SelectItem value="default">Default</SelectItem>
                  }
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Playstyle */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Playstyle *</Label>
            <div className="flex flex-wrap gap-2">
              {PLAYSTYLES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlaystyle(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    playstyle === p.id ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:border-primary/50"
                  }`}
                  data-testid={`button-playstyle-${p.id}`}
                >
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main Skills */}
          <div className="space-y-2">
            <Label htmlFor="skills" className="text-sm font-semibold">Main Skills</Label>
            <Input id="skills" placeholder="e.g. Smite, Hammer Throw, Holy Aura" value={mainSkills} onChange={e => setMainSkills(e.target.value)} data-testid="input-skills" />
            <p className="text-[11px] text-muted-foreground">Comma-separated list</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="desc" className="text-sm font-semibold">Description</Label>
            <Textarea id="desc" placeholder="Brief overview of the build, what makes it strong, tips for playing it..." value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-description" />
          </div>

          {/* Engagement Text */}
          <div className="space-y-2">
            <Label htmlFor="engagement" className="text-sm font-semibold">Hook / Engagement Text <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="engagement" placeholder="e.g. Freeze entire screens and teleport through maps faster than any other class." value={engagementText} onChange={e => setEngagementText(e.target.value)} rows={2} data-testid="input-engagement" />
            <p className="text-[11px] text-muted-foreground">A punchy 1-2 sentence hook that makes users want to try the build</p>
          </div>

          {/* Difficulty + Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Difficulty <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger data-testid="select-difficulty">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Budget <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={budgetLevel} onValueChange={setBudgetLevel}>
                <SelectTrigger data-testid="select-budget">
                  <SelectValue placeholder="Select budget" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="mid-range">Mid-Range</SelectItem>
                  <SelectItem value="expensive">Expensive</SelectItem>
                  <SelectItem value="endgame">Endgame (BiS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pros */}
          <div className="space-y-2">
            <Label htmlFor="pros" className="text-sm font-semibold">Pros <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="pros" placeholder="e.g. High AoE damage, Easy to gear, Great mapping speed" value={prosText} onChange={e => setProsText(e.target.value)} data-testid="input-pros" />
            <p className="text-[11px] text-muted-foreground">Comma-separated list of strengths</p>
          </div>

          {/* Cons */}
          <div className="space-y-2">
            <Label htmlFor="cons" className="text-sm font-semibold">Cons <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="cons" placeholder="e.g. Squishy, Expensive endgame, Complex rotation" value={consText} onChange={e => setConsText(e.target.value)} data-testid="input-cons" />
            <p className="text-[11px] text-muted-foreground">Comma-separated list of weaknesses</p>
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!isValid || submitMutation.isPending}
            className="w-full h-11"
            data-testid="button-submit"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Submit Build</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
