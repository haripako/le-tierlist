import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Gamepad2 } from "lucide-react";
import type { GameWithMeta } from "@shared/schema";

const CATEGORIES = ["arpg", "looter-shooter", "mmo", "other"] as const;

export default function AdminGamesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showAddGame, setShowAddGame] = useState(false);
  const [editGame, setEditGame] = useState<GameWithMeta | null>(null);

  const [gSlug, setGSlug] = useState("");
  const [gName, setGName] = useState("");
  const [gColor, setGColor] = useState("#d4a537");
  const [gIcon, setGIcon] = useState("⚔️");
  const [gCategory, setGCategory] = useState("arpg");
  const [gHasSeasons, setGHasSeasons] = useState(false);
  const [gSortOrder, setGSortOrder] = useState("0");

  const { data: games, isLoading } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/games"); return res.json(); },
  });

  function resetForm() {
    setGSlug(""); setGName(""); setGColor("#d4a537"); setGIcon("⚔️");
    setGCategory("arpg"); setGHasSeasons(false); setGSortOrder("0");
  }

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/games", {
      adminUserId: user?.id, slug: gSlug, name: gName, color: gColor,
      icon: gIcon, category: gCategory, hasSeasons: gHasSeasons,
      isActive: true, sortOrder: parseInt(gSortOrder),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Game created" });
      resetForm(); setShowAddGame(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/games/${id}`, {
      adminUserId: user?.id, slug: gSlug, name: gName, color: gColor,
      icon: gIcon, category: gCategory, hasSeasons: gHasSeasons,
      sortOrder: parseInt(gSortOrder),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Game updated" });
      setEditGame(null); resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/games/${id}`, { adminUserId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Game deactivated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(game: GameWithMeta) {
    setEditGame(game);
    setGSlug(game.slug);
    setGName(game.name);
    setGColor(game.color);
    setGIcon(game.icon);
    setGCategory(game.category);
    setGHasSeasons(game.hasSeasons);
    setGSortOrder(String(game.sortOrder));
  }

  const GameForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Game Name *</Label>
          <Input value={gName} onChange={e => { setGName(e.target.value); if (!editGame) setGSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }} placeholder="e.g. Last Epoch" data-testid="input-game-name" />
        </div>
        <div className="space-y-2">
          <Label>Slug *</Label>
          <Input value={gSlug} onChange={e => setGSlug(e.target.value)} placeholder="e.g. last-epoch" data-testid="input-game-slug" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Icon (emoji)</Label>
          <Input value={gIcon} onChange={e => setGIcon(e.target.value)} placeholder="⚔️" data-testid="input-game-icon" />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Input type="color" value={gColor} onChange={e => setGColor(e.target.value)} data-testid="input-game-color" />
        </div>
        <div className="space-y-2">
          <Label>Sort Order</Label>
          <Input type="number" value={gSortOrder} onChange={e => setGSortOrder(e.target.value)} data-testid="input-game-sort" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={gCategory} onValueChange={setGCategory}>
          <SelectTrigger data-testid="select-game-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={gHasSeasons} onCheckedChange={setGHasSeasons} data-testid="switch-has-seasons" />
        <Label>Has Seasons</Label>
      </div>
    </div>
  );

  return (
    <AdminLayout title="Games">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { resetForm(); setShowAddGame(true); }} data-testid="button-add-game">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Game
          </Button>
        </div>

        <Card data-testid="games-admin-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gamepad2 className="w-4 h-4" /> All Games ({games?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-2">
                {(games ?? []).map(game => (
                  <div key={game.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" data-testid={`game-admin-row-${game.id}`}>
                    <span className="text-xl shrink-0">{game.icon}</span>
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: game.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{game.name}</span>
                        <Badge variant="outline" className="text-[10px]">{game.category}</Badge>
                        {game.hasSeasons && <Badge variant="secondary" className="text-[10px]">seasons</Badge>}
                        <span className="text-xs text-muted-foreground">{game.buildCount} builds</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {game.modes?.length ?? 0} modes · {game.classes?.length ?? 0} classes · sort: {game.sortOrder}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(game)} data-testid={`button-edit-game-${game.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(game.id)} data-testid={`button-delete-game-${game.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add dialog */}
      <Dialog open={showAddGame} onOpenChange={setShowAddGame}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Game</DialogTitle></DialogHeader>
          <GameForm />
          <Button onClick={() => createMutation.mutate()} disabled={!gName || !gSlug || createMutation.isPending} className="w-full mt-2" data-testid="button-create-game">
            Create Game
          </Button>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editGame} onOpenChange={open => { if (!open) { setEditGame(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Game: {editGame?.name}</DialogTitle></DialogHeader>
          <GameForm />
          <Button onClick={() => editGame && updateMutation.mutate(editGame.id)} disabled={updateMutation.isPending} className="w-full mt-2" data-testid="button-update-game">
            Save Changes
          </Button>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
