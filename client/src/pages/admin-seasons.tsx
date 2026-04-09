import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import type { Season, GameWithMeta } from "@shared/schema";

export default function AdminSeasonsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [editSeason, setEditSeason] = useState<Season | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedGameSlug, setSelectedGameSlug] = useState<string>("all");

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [patch, setPatch] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [formGameId, setFormGameId] = useState("");

  const { data: games } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/games"); return res.json(); },
  });

  // Only show games with hasSeasons
  const seasonableGames = (games ?? []).filter(g => g.hasSeasons);

  const { data: seasons, isLoading } = useQuery<Season[]>({
    queryKey: ["/api/seasons", selectedGameSlug],
    queryFn: async () => {
      if (selectedGameSlug !== "all") {
        const res = await apiRequest("GET", `/api/games/${selectedGameSlug}/seasons`);
        return res.json();
      }
      const res = await apiRequest("GET", "/api/seasons");
      return res.json();
    },
  });

  function resetForm() { setSlug(""); setName(""); setPatch(""); setIsActive(true); setSortOrder(0); setFormGameId(""); }

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/seasons", {
      adminUserId: user?.id, slug, name, patch, isActive,
      sortOrder, gameId: parseInt(formGameId),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      toast({ title: "Season created" });
      resetForm(); setShowAdd(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/seasons/${id}`, {
      adminUserId: user?.id, slug, name, patch, isActive, sortOrder,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      toast({ title: "Season updated" });
      setEditSeason(null); resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/seasons/${id}`, { adminUserId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      toast({ title: "Season deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(s: Season) {
    setEditSeason(s);
    setSlug(s.slug); setName(s.name); setPatch(s.patch);
    setIsActive(s.isActive); setSortOrder(s.sortOrder);
  }

  const getGameName = (gameId: number) => games?.find(g => g.id === gameId)?.name ?? "Unknown";

  const SeasonForm = ({ includeGame }: { includeGame?: boolean }) => (
    <div className="space-y-4">
      {includeGame && (
        <div className="space-y-2">
          <Label>Game (must have seasons) *</Label>
          <Select value={formGameId} onValueChange={setFormGameId}>
            <SelectTrigger data-testid="select-season-game">
              <SelectValue placeholder="Select game" />
            </SelectTrigger>
            <SelectContent>
              {seasonableGames.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.icon} {g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Season Name *</Label>
          <Input value={name} onChange={e => { setName(e.target.value); if (!editSeason) setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40)); }} placeholder="e.g. Season 4" data-testid="input-season-name" />
        </div>
        <div className="space-y-2">
          <Label>Patch *</Label>
          <Input value={patch} onChange={e => setPatch(e.target.value)} placeholder="e.g. 1.4" data-testid="input-season-patch" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Slug *</Label>
        <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="e.g. le-s4" data-testid="input-season-slug" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Sort Order</Label>
          <Input type="number" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 0)} data-testid="input-season-sort" />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-season-active" />
          <Label>Active</Label>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout title="Seasons">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Select value={selectedGameSlug} onValueChange={setSelectedGameSlug}>
            <SelectTrigger className="w-64" data-testid="select-admin-game-season">
              <SelectValue placeholder="All Games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              {seasonableGames.map(g => (
                <SelectItem key={g.id} value={g.slug}>{g.icon} {g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-add-season">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Season
          </Button>
        </div>

        <Card data-testid="seasons-admin-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4" /> Seasons ({seasons?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : (seasons ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No seasons yet.</p>
            ) : (
              <div className="space-y-2">
                {(seasons ?? []).map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" data-testid={`season-row-${s.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.isActive && <Badge variant="secondary" className="text-[10px]">active</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getGameName(s.gameId)} · patch {s.patch} · sort: {s.sortOrder}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-season-${s.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-season-${s.id}`}>
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

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Season</DialogTitle></DialogHeader>
          <SeasonForm includeGame />
          <Button onClick={() => createMutation.mutate()} disabled={!name || !slug || !patch || !formGameId || createMutation.isPending} className="w-full mt-2" data-testid="button-create-season">
            Create Season
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSeason} onOpenChange={open => { if (!open) { setEditSeason(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Season</DialogTitle></DialogHeader>
          <SeasonForm />
          <Button onClick={() => editSeason && updateMutation.mutate(editSeason.id)} disabled={updateMutation.isPending} className="w-full mt-2" data-testid="button-update-season">
            Save Changes
          </Button>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
