import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ArrowLeft, Shield, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { GameWithMeta, GameClass } from "@shared/schema";

export default function AdminGamesPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // Game form
  const [editGame, setEditGame] = useState<GameWithMeta | null>(null);
  const [showAddGame, setShowAddGame] = useState(false);
  const [gSlug, setGSlug] = useState("");
  const [gName, setGName] = useState("");
  const [gColor, setGColor] = useState("#d4a537");
  const [gIcon, setGIcon] = useState("⚔️");
  const [gCategory, setGCategory] = useState("arpg");

  // Class form
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [showAddClass, setShowAddClass] = useState(false);
  const [addClassGameId, setAddClassGameId] = useState<number | null>(null);
  const [cName, setCName] = useState("");
  const [cMasteries, setCMasteries] = useState("");
  const [cColor, setCColor] = useState("#888888");

  const { data: games, isLoading } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/games"); return res.json(); },
  });

  const createGameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/games", {
        adminUserId: user!.id, slug: gSlug, name: gName, color: gColor,
        icon: gIcon, category: gCategory, isActive: true, sortOrder: 0,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setShowAddGame(false);
      resetGameForm();
      toast({ title: "Game created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateGameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/games/${editGame!.id}`, {
        adminUserId: user!.id, slug: gSlug, name: gName, color: gColor, icon: gIcon, category: gCategory,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setEditGame(null);
      resetGameForm();
      toast({ title: "Game updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/games/${id}`, { adminUserId: user!.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Game removed" });
    },
  });

  const createClassMutation = useMutation({
    mutationFn: async () => {
      const masteryArray = cMasteries.split(",").map(m => m.trim()).filter(Boolean);
      const game = games?.find(g => g.id === addClassGameId);
      if (!game) throw new Error("Game not found");
      const res = await apiRequest("POST", `/api/games/${game.slug}/classes`, {
        adminUserId: user!.id, name: cName, masteries: JSON.stringify(masteryArray), color: cColor,
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setShowAddClass(false);
      resetClassForm();
      toast({ title: "Class added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/game-classes/${id}`, { adminUserId: user!.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Class removed" });
    },
  });

  function resetGameForm() { setGSlug(""); setGName(""); setGColor("#d4a537"); setGIcon("⚔️"); setGCategory("arpg"); }
  function resetClassForm() { setCName(""); setCMasteries(""); setCColor("#888888"); }

  function openEditGame(g: GameWithMeta) {
    setEditGame(g);
    setGSlug(g.slug); setGName(g.name); setGColor(g.color); setGIcon(g.icon); setGCategory(g.category);
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Shield className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="font-medium">Admin access required</p>
        <Link href="/"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link>
      </div>
    );
  }

  const GameForm = ({ onSubmit, isPending }: { onSubmit: () => void; isPending: boolean }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Slug *</Label>
          <Input placeholder="last-epoch" value={gSlug} onChange={e => setGSlug(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input placeholder="Last Epoch" value={gName} onChange={e => setGName(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Icon (emoji)</Label>
          <Input placeholder="⚔️" value={gIcon} onChange={e => setGIcon(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Color (hex)</Label>
          <div className="flex gap-2">
            <Input placeholder="#d4a537" value={gColor} onChange={e => setGColor(e.target.value)} />
            <input type="color" value={gColor} onChange={e => setGColor(e.target.value)} className="w-10 h-9 rounded border border-input cursor-pointer" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={gCategory} onValueChange={setGCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["arpg", "looter-shooter", "mmo", "other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={onSubmit} disabled={!gSlug || !gName || isPending} className="w-full">
        {isPending ? "Saving…" : "Save Game"}
      </Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Manage Games</h1>
          <p className="text-sm text-muted-foreground">Add, edit, and manage games and their classes</p>
        </div>
        <Button size="sm" onClick={() => { resetGameForm(); setShowAddGame(true); }} data-testid="button-add-game">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Game
        </Button>
      </div>

      {/* Add game dialog */}
      <Dialog open={showAddGame} onOpenChange={setShowAddGame}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>Add New Game</DialogTitle></DialogHeader>
          <GameForm onSubmit={() => createGameMutation.mutate()} isPending={createGameMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit game dialog */}
      <Dialog open={!!editGame} onOpenChange={open => !open && setEditGame(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>Edit Game</DialogTitle></DialogHeader>
          <GameForm onSubmit={() => updateGameMutation.mutate()} isPending={updateGameMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Add class dialog */}
      <Dialog open={showAddClass} onOpenChange={open => !open && (setShowAddClass(false), resetClassForm())}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Class to {games?.find(g => g.id === addClassGameId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Input placeholder="Sentinel" value={cName} onChange={e => setCName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Masteries (comma-separated)</Label>
              <Input placeholder="Void Knight, Forge Guard, Paladin" value={cMasteries} onChange={e => setCMasteries(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input placeholder="#888888" value={cColor} onChange={e => setCColor(e.target.value)} />
                <input type="color" value={cColor} onChange={e => setCColor(e.target.value)} className="w-10 h-9 rounded border border-input cursor-pointer" />
              </div>
            </div>
            <Button onClick={() => createClassMutation.mutate()} disabled={!cName || createClassMutation.isPending} className="w-full">
              {createClassMutation.isPending ? "Adding…" : "Add Class"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Games list */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-card rounded-lg border border-border animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {(games ?? []).map(g => (
            <div key={g.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ background: `${g.color}20` }}>
                  {g.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{g.name}</span>
                    <Badge variant="outline" className="text-[10px]">{g.category}</Badge>
                    <span className="text-xs text-muted-foreground">{g.classes.length} classes</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{g.slug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setExpandedGame(expandedGame === g.id ? null : g.id)}>
                    {expandedGame === g.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Classes
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEditGame(g)} data-testid={`button-edit-game-${g.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteGameMutation.mutate(g.id)} className="hover:text-destructive" data-testid={`button-delete-game-${g.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {expandedGame === g.id && (
                <div className="border-t border-border p-4 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Classes</p>
                    <Button size="sm" variant="outline" onClick={() => { setAddClassGameId(g.id); resetClassForm(); setShowAddClass(true); }}>
                      <Plus className="w-3 h-3 mr-1" /> Add Class
                    </Button>
                  </div>
                  {g.classes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No classes defined.</p>
                  ) : (
                    <div className="space-y-1">
                      {g.classes.map((cls: GameClass) => {
                        const masteries: string[] = (() => { try { return JSON.parse(cls.masteries); } catch { return []; } })();
                        return (
                          <div key={cls.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-secondary/50">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cls.color }} />
                            <span className="text-sm font-medium">{cls.name}</span>
                            {masteries.length > 0 && (
                              <div className="flex flex-wrap gap-1 ml-2">
                                {masteries.map(m => (
                                  <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-background text-muted-foreground">{m}</span>
                                ))}
                              </div>
                            )}
                            <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0 hover:text-destructive" onClick={() => deleteClassMutation.mutate(cls.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
