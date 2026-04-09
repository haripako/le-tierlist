import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import type { GameWithMeta, GameMode } from "@shared/schema";

export default function AdminGameModesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedGameSlug, setSelectedGameSlug] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [editMode, setEditMode] = useState<GameMode | null>(null);

  // Form state
  const [modeName, setModeName] = useState("");
  const [modeSlug, setModeSlug] = useState("");
  const [modeIsDefault, setModeIsDefault] = useState(false);
  const [modeSortOrder, setModeSortOrder] = useState("0");

  const { data: games } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/games"); return res.json(); },
  });

  const { data: modes, isLoading: modesLoading } = useQuery<GameMode[]>({
    queryKey: ["/api/games", selectedGameSlug, "modes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/games/${selectedGameSlug}/modes`);
      return res.json();
    },
    enabled: !!selectedGameSlug,
  });

  function resetForm() {
    setModeName(""); setModeSlug(""); setModeIsDefault(false); setModeSortOrder("0");
  }

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/games/${selectedGameSlug}/modes`, {
      adminUserId: user?.id, name: modeName, slug: modeSlug,
      isDefault: modeIsDefault, sortOrder: parseInt(modeSortOrder),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", selectedGameSlug, "modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Mode created" });
      resetForm(); setAddOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/game-modes/${id}`, {
      adminUserId: user?.id, name: modeName, slug: modeSlug,
      isDefault: modeIsDefault, sortOrder: parseInt(modeSortOrder),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", selectedGameSlug, "modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Mode updated" });
      setEditMode(null); resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/game-modes/${id}`, { adminUserId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", selectedGameSlug, "modes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Mode deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(mode: GameMode) {
    setEditMode(mode);
    setModeName(mode.name);
    setModeSlug(mode.slug);
    setModeIsDefault(mode.isDefault);
    setModeSortOrder(String(mode.sortOrder));
  }

  return (
    <AdminLayout title="Game Modes">
      <div className="space-y-6">
        {/* Game selector */}
        <div className="flex items-center gap-3">
          <div className="w-64">
            <Select value={selectedGameSlug} onValueChange={setSelectedGameSlug}>
              <SelectTrigger data-testid="select-admin-game">
                <SelectValue placeholder="Select a game…" />
              </SelectTrigger>
              <SelectContent>
                {(games ?? []).map(g => (
                  <SelectItem key={g.id} value={g.slug}>
                    {g.icon} {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedGameSlug && (
            <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }} data-testid="button-add-mode">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Mode
            </Button>
          )}
        </div>

        {/* Modes list */}
        {selectedGameSlug && (
          <Card data-testid="modes-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Modes for {games?.find(g => g.slug === selectedGameSlug)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {modesLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (modes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No modes yet.</p>
              ) : (
                <div className="space-y-2">
                  {(modes ?? []).map(mode => (
                    <div key={mode.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" data-testid={`mode-row-${mode.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{mode.name}</span>
                          {mode.isDefault && <Badge variant="secondary" className="text-[10px]">default</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">slug: {mode.slug} · order: {mode.sortOrder}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(mode)} data-testid={`button-edit-mode-${mode.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(mode.id)} data-testid={`button-delete-mode-${mode.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!selectedGameSlug && (
          <p className="text-sm text-muted-foreground">Select a game to manage its modes.</p>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Game Mode</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mode Name</Label>
              <Input value={modeName} onChange={e => { setModeName(e.target.value); setModeSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }} placeholder="e.g. Softcore" data-testid="input-mode-name" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={modeSlug} onChange={e => setModeSlug(e.target.value)} placeholder="e.g. softcore" data-testid="input-mode-slug" />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={modeSortOrder} onChange={e => setModeSortOrder(e.target.value)} data-testid="input-mode-sort" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={modeIsDefault} onCheckedChange={setModeIsDefault} data-testid="switch-mode-default" />
              <Label>Default mode</Label>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!modeName || !modeSlug || createMutation.isPending} className="w-full" data-testid="button-create-mode">
              Create Mode
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editMode} onOpenChange={open => { if (!open) { setEditMode(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Game Mode</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mode Name</Label>
              <Input value={modeName} onChange={e => setModeName(e.target.value)} data-testid="input-edit-mode-name" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={modeSlug} onChange={e => setModeSlug(e.target.value)} data-testid="input-edit-mode-slug" />
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={modeSortOrder} onChange={e => setModeSortOrder(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={modeIsDefault} onCheckedChange={setModeIsDefault} />
              <Label>Default mode</Label>
            </div>
            <Button onClick={() => editMode && updateMutation.mutate(editMode.id)} disabled={updateMutation.isPending} className="w-full" data-testid="button-update-mode">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
