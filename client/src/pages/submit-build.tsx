import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CLASSES, SEASONS, GAME_MODES, PLAYSTYLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

export default function SubmitBuildPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [mastery, setMastery] = useState("");
  const [seasonId, setSeasonId] = useState("s4");
  const [gameMode, setGameMode] = useState("softcore");
  const [playstyle, setPlaystyle] = useState("");
  const [description, setDescription] = useState("");
  const [mainSkills, setMainSkills] = useState("");
  const [guideUrl, setGuideUrl] = useState("");
  const [author, setAuthor] = useState("");

  const selectedClass = CLASSES.find((c) => c.id === className);
  const availableMasteries = selectedClass?.masteries ?? [];

  const submitMutation = useMutation({
    mutationFn: async () => {
      const skillsArray = mainSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiRequest("POST", "/api/builds", {
        name,
        className,
        mastery,
        seasonId,
        gameMode,
        playstyle,
        description,
        mainSkills: JSON.stringify(skillsArray),
        guideUrl: guideUrl || null,
        author,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tier-list"] });
      toast({ title: "Build submitted", description: "Your build has been added to the tier list." });
      navigate("/");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit build. Check all fields.", variant: "destructive" });
    },
  });

  const isValid = name && className && mastery && seasonId && gameMode && playstyle && description && mainSkills && author;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          data-testid="text-submit-title"
        >
          Submit a Build
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share your build with the community. It will appear in the tier list once submitted.
        </p>
      </div>

      <div className="space-y-4 bg-card border border-border rounded-lg p-6">
        {/* Build Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Build Name</Label>
          <Input
            id="name"
            placeholder="e.g., Lightning Smite Paladin"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-name"
          />
        </div>

        {/* Class + Mastery row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Class</Label>
            <Select
              value={className}
              onValueChange={(v) => {
                setClassName(v);
                setMastery("");
              }}
            >
              <SelectTrigger data-testid="select-class">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mastery</Label>
            <Select value={mastery} onValueChange={setMastery} disabled={!className}>
              <SelectTrigger data-testid="select-mastery">
                <SelectValue placeholder="Select mastery" />
              </SelectTrigger>
              <SelectContent>
                {availableMasteries.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Season + Mode + Playstyle */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Season</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger data-testid="select-season">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Game Mode</Label>
            <Select value={gameMode} onValueChange={setGameMode}>
              <SelectTrigger data-testid="select-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GAME_MODES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.icon} {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Playstyle</Label>
            <Select value={playstyle} onValueChange={setPlaystyle}>
              <SelectTrigger data-testid="select-playstyle">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {PLAYSTYLES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.icon} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe your build, its strengths, and how it plays..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            data-testid="input-description"
          />
        </div>

        {/* Main Skills */}
        <div className="space-y-2">
          <Label htmlFor="skills">Main Skills (comma-separated)</Label>
          <Input
            id="skills"
            placeholder="e.g., Smite, Hammer Throw, Holy Aura, Lunge, Sigils of Hope"
            value={mainSkills}
            onChange={(e) => setMainSkills(e.target.value)}
            data-testid="input-skills"
          />
        </div>

        {/* Guide URL (optional) */}
        <div className="space-y-2">
          <Label htmlFor="guide">Guide URL (optional)</Label>
          <Input
            id="guide"
            placeholder="https://youtube.com/... or https://lastepochtools.com/..."
            value={guideUrl}
            onChange={(e) => setGuideUrl(e.target.value)}
            data-testid="input-guide-url"
          />
        </div>

        {/* Author */}
        <div className="space-y-2">
          <Label htmlFor="author">Your Name / Username</Label>
          <Input
            id="author"
            placeholder="Your name"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            data-testid="input-author"
          />
        </div>

        <Button
          onClick={() => submitMutation.mutate()}
          disabled={!isValid || submitMutation.isPending}
          className="w-full"
          data-testid="button-submit"
        >
          <Send className="w-4 h-4 mr-2" />
          {submitMutation.isPending ? "Submitting..." : "Submit Build"}
        </Button>
      </div>
    </div>
  );
}
