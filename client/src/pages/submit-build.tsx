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
import { Send, ExternalLink, AlertCircle, Loader2, Sparkles, ChevronRight, Link as LinkIcon, ArrowLeft } from "lucide-react";
import type { Season } from "@shared/schema";

type ExtractedBuild = {
  name: string;
  className: string;
  mastery: string;
  playstyle: string;
  description: string;
  mainSkills: string[];
  sourceType: string;
  confidence: "high" | "medium" | "low";
};

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

  // Step: "url" | "edit"
  const [step, setStep] = useState<"url" | "edit">("url");

  // URL step
  const [guideUrl, setGuideUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // Edit step — pre-filled from extraction
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [mastery, setMastery] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [gameMode, setGameMode] = useState("softcore");
  const [playstyle, setPlaystyle] = useState("");
  const [description, setDescription] = useState("");
  const [mainSkills, setMainSkills] = useState("");
  const [extractConfidence, setExtractConfidence] = useState<string>("");

  const { data: seasons } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/seasons"); return res.json(); },
  });

  const activeSeasons = seasons?.filter(s => s.isActive) ?? [];
  const selectedClass = CLASSES.find(c => c.id === className);
  const availableMasteries = selectedClass?.masteries ?? [];
  const detectedSource = useMemo(() => guideUrl ? detectSourceClient(guideUrl) : null, [guideUrl]);
  const sourceInfo = detectedSource ? SOURCE_CONFIG[detectedSource] : null;

  // Validate URL
  const isValidUrl = useMemo(() => {
    try { new URL(guideUrl); return true; } catch { return false; }
  }, [guideUrl]);

  // Extract build from URL
  const handleExtract = async () => {
    if (!isValidUrl) return;
    setIsExtracting(true);
    try {
      const res = await apiRequest("POST", "/api/extract-build", { url: guideUrl });
      const data: ExtractedBuild = await res.json();

      // Pre-fill form with extracted data
      if (data.name) setName(data.name);
      if (data.className) setClassName(data.className);
      if (data.mastery) setMastery(data.mastery);
      if (data.playstyle) setPlaystyle(data.playstyle);
      if (data.description) setDescription(data.description);
      if (data.mainSkills?.length) setMainSkills(data.mainSkills.join(", "));
      setExtractConfidence(data.confidence);

      // Default season to the most recent active one
      if (activeSeasons.length > 0 && !seasonId) {
        setSeasonId(String(activeSeasons[0].id));
      }

      setStep("edit");
    } catch (e: any) {
      toast({ title: "Extraction failed", description: "Could not read the URL. You can still fill in the details manually.", variant: "destructive" });
      // Go to edit anyway so user can fill manually
      if (activeSeasons.length > 0 && !seasonId) {
        setSeasonId(String(activeSeasons[0].id));
      }
      setStep("edit");
    } finally {
      setIsExtracting(false);
    }
  };

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
        submitterId: user?.id || null,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tier-list"] });
      toast({ title: "Build submitted", description: isLoggedIn ? "Your build has been added. Earn karma as people vote on it." : "Your build has been added to the tier list." });
      navigate("/");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const isValid = name && className && mastery && seasonId && gameMode && playstyle && guideUrl;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }} data-testid="text-submit-title">
          Submit a Build Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a build guide URL and we'll fill in the details automatically.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${step === "url" ? "bg-primary/10 text-primary font-medium" : "bg-secondary"}`}>
          <LinkIcon className="w-3 h-3" /> Paste URL
        </span>
        <ChevronRight className="w-3 h-3" />
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${step === "edit" ? "bg-primary/10 text-primary font-medium" : "bg-secondary"}`}>
          <Sparkles className="w-3 h-3" /> Review & Submit
        </span>
      </div>

      {step === "url" ? (
        /* ─── Step 1: Paste URL ─── */
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guide" className="text-sm font-semibold">Build Guide URL</Label>
            <div className="relative">
              <Input
                id="guide"
                placeholder="https://www.youtube.com/watch?v=... or https://maxroll.gg/..."
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
            <p className="text-[11px] text-muted-foreground">
              Supported: YouTube, Maxroll, Last Epoch Tools, Mobalytics, Reddit, or any URL
            </p>
          </div>

          <Button
            onClick={handleExtract}
            disabled={!isValidUrl || isExtracting}
            className="w-full h-11"
            data-testid="button-extract"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extracting build info...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Extract Build Info
              </>
            )}
          </Button>

          <button
            onClick={() => {
              if (activeSeasons.length > 0 && !seasonId) {
                setSeasonId(String(activeSeasons[0].id));
              }
              setStep("edit");
            }}
            className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            or skip and fill in manually
          </button>
        </div>
      ) : (
        /* ─── Step 2: Review & Edit ─── */
        <div className="space-y-4">
          {/* Back to URL step */}
          <button
            onClick={() => setStep("url")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Change URL
          </button>

          {/* URL preview */}
          {guideUrl && sourceInfo && (
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <span className="text-lg">{sourceInfo.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${sourceInfo.color}`}>{sourceInfo.name}</p>
                <p className="text-xs text-muted-foreground truncate">{guideUrl}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
            </a>
          )}

          {/* Confidence indicator */}
          {extractConfidence && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              extractConfidence === "high" ? "border-green-500/30 bg-green-500/5 text-green-400" :
              extractConfidence === "medium" ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-400" :
              "border-muted-foreground/30 bg-secondary text-muted-foreground"
            }`}>
              {extractConfidence === "high" ? "✓ High confidence — most fields auto-filled" :
               extractConfidence === "medium" ? "◐ Some fields auto-filled — please review" :
               "○ Low confidence — please fill in the details below"}
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
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
              <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="description" placeholder="Brief description of the build..." value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-description" />
            </div>

            {/* Main Skills */}
            <div className="space-y-2">
              <Label htmlFor="skills">Main Skills <span className="text-muted-foreground font-normal">(comma-separated, optional)</span></Label>
              <Input id="skills" placeholder="e.g., Smite, Hammer Throw, Holy Aura" value={mainSkills} onChange={e => setMainSkills(e.target.value)} data-testid="input-skills" />
            </div>

            <Button onClick={() => submitMutation.mutate()} disabled={!isValid || submitMutation.isPending} className="w-full" data-testid="button-submit">
              <Send className="w-4 h-4 mr-2" />
              {submitMutation.isPending ? "Submitting..." : "Submit Build Guide"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
