import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowLeft, Shield } from "lucide-react";
import { Link } from "wouter";
import type { Season, GameWithMeta } from "@shared/schema";

export default function AdminSeasonsPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [editSeason, setEditSeason] = useState<Season | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string>("all");

  // Form state
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

  const { data: seasons, isLoading } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/seasons"); return res.json(); },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/seasons", {
        adminUserId: user!.id, slug, name, patch, isActive, sortOrder,
        gameId: parseInt(formGameId),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setShowAdd(false);
      resetForm();
      toast({ title: "Season created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/seasons/${editSeason!.id}`, {
        adminUserId: user!.id, slug, name, patch, isActive, sortOrder,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setEditSeason(null);
      resetForm();
      toast({ title: "Season updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/seasons/${id}`, { adminUserId: user!.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      toast({ title: "Season deleted" });
    },
  });

  function resetForm() { setSlug(""); setName(""); setPatch(""); setIsActive(true); setSortOrder(0); setFormGameId(""); }

  function openEdit(season: Season) {
    setEditSeason(season);
    setSlug(season.slug);
    setName(season.name);
    setPatch(season.patch);
    setIsActive(season.isActive);
    setSortOrder(season.sortOrder);
    setFormGameId(String(season.gameId));
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

  const filteredSeasons = selectedGameId === "all"
    ? (seasons ?? [])
    : (seasons ?? []).filter(s => s.gameId === parseInt(selectedGameId));

  const SeasonForm = ({ onSubmit, isPending }: { onSubmit: () => void; isPending: boolean }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Game *</Label>
        <Select value={formGameId} onValueChange={setFormGameId}>
          <SelectTrigger><SelectValue placeholder="Select game" /></SelectTrigger>
          <SelectContent>
            {(games ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.icon} {g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Slug *</Label>
          <Input placeholder="le-s4" value={slug} onChange={e => setSlug(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Patch *</Label>
          <Input placeholder="1.4" value={patch} onChange={e => setPatch(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Display Name *</Label>
        <Input placeholder="Season 4 — Shattered Omens" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Sort Order</Label>
          <Input type="number" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 0)} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="active">Active</Label>
        </div>
      </div>
      <Button onClick={onSubmit} disabled={!slug || !name || !formGameId || isPending} className="w-full">
        {isPending ? "Saving…" : "Save Season"}
      </Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back</Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Manage Seasons</h1>
          <p className="text-sm text-muted-foreground">Add and manage game seasons and patches</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-add-season">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Season
        </Button>
      </div>

      {/* Game filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground shrink-0">Filter by game:</Label>
        <Select value={selectedGameId} onValueChange={setSelectedGameId}>
          <SelectTrigger className="w-[220px] bg-card border-border">
            <SelectValue placeholder="All Games" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Games</SelectItem>
            {(games ?? []).map(g => <SelectItem key={g.id} value={String(g.id)}>{g.icon} {g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Add Season</DialogTitle></DialogHeader>
          <SeasonForm onSubmit={() => createMutation.mutate()} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editSeason} onOpenChange={open => !open && setEditSeason(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Edit Season</DialogTitle></DialogHeader>
          <SeasonForm onSubmit={() => updateMutation.mutate()} isPending={updateMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Seasons list */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-card rounded-lg border border-border animate-pulse" />)}</div>
      ) : filteredSeasons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No seasons found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSeasons.map(s => {
            const game = games?.find(g => g.id === s.gameId);
            return (
              <div key={s.id} className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card" data-testid={`row-season-${s.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {game && <span className="text-base">{game.icon}</span>}
                    <span className="font-medium">{s.name}</span>
                    <Badge variant={s.isActive ? "default" : "secondary"} className="text-[10px]">
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {game && <span>{game.name}</span>}
                    <span>Patch {s.patch}</span>
                    <span className="font-mono">{s.slug}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(s)} data-testid={`button-edit-season-${s.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="hover:text-destructive" onClick={() => deleteMutation.mutate(s.id)} data-testid={`button-delete-season-${s.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
