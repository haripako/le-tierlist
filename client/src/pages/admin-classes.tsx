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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Swords } from "lucide-react";
import type { GameWithMeta, GameClass } from "@shared/schema";

export default function AdminClassesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedGameSlug, setSelectedGameSlug] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [editClass, setEditClass] = useState<GameClass | null>(null);

  const [className, setClassName] = useState("");
  const [classColor, setClassColor] = useState("#888888");
  const [classMasteries, setClassMasteries] = useState("");

  const { data: games } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/games"); return res.json(); },
  });

  const { data: classes, isLoading: classesLoading } = useQuery<GameClass[]>({
    queryKey: ["/api/games", selectedGameSlug, "classes"],
    queryFn: async () => { const res = await apiRequest("GET", `/api/games/${selectedGameSlug}/classes`); return res.json(); },
    enabled: !!selectedGameSlug,
  });

  function resetForm() { setClassName(""); setClassColor("#888888"); setClassMasteries(""); }

  const createMutation = useMutation({
    mutationFn: async () => {
      const masteriesJson = classMasteries ? JSON.stringify(classMasteries.split(",").map(s => s.trim()).filter(Boolean)) : "[]";
      return apiRequest("POST", `/api/games/${selectedGameSlug}/classes`, {
        adminUserId: user?.id, name: className, color: classColor, masteries: masteriesJson,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", selectedGameSlug, "classes"] });
      toast({ title: "Class created" });
      resetForm(); setAddOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      const masteriesJson = classMasteries ? JSON.stringify(classMasteries.split(",").map(s => s.trim()).filter(Boolean)) : "[]";
      return apiRequest("PATCH", `/api/game-classes/${id}`, {
        adminUserId: user?.id, name: className, color: classColor, masteries: masteriesJson,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", selectedGameSlug, "classes"] });
      toast({ title: "Class updated" });
      setEditClass(null); resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/game-classes/${id}`, { adminUserId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", selectedGameSlug, "classes"] });
      toast({ title: "Class deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(cls: GameClass) {
    setEditClass(cls);
    setClassName(cls.name);
    setClassColor(cls.color);
    try { setClassMasteries(JSON.parse(cls.masteries).join(", ")); } catch { setClassMasteries(""); }
  }

  return (
    <AdminLayout title="Classes">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-64">
            <Select value={selectedGameSlug} onValueChange={setSelectedGameSlug}>
              <SelectTrigger data-testid="select-admin-game-classes">
                <SelectValue placeholder="Select a game…" />
              </SelectTrigger>
              <SelectContent>
                {(games ?? []).map(g => (
                  <SelectItem key={g.id} value={g.slug}>{g.icon} {g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedGameSlug && (
            <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }} data-testid="button-add-class">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Class
            </Button>
          )}
        </div>

        {selectedGameSlug && (
          <Card data-testid="classes-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Swords className="w-4 h-4" />
                Classes for {games?.find(g => g.slug === selectedGameSlug)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {classesLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (classes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No classes yet.</p>
              ) : (
                <div className="space-y-2">
                  {(classes ?? []).map(cls => {
                    let masteries: string[] = [];
                    try { masteries = JSON.parse(cls.masteries); } catch {}
                    return (
                      <div key={cls.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" data-testid={`class-row-${cls.id}`}>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cls.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{cls.name}</p>
                          {masteries.length > 0 && (
                            <p className="text-xs text-muted-foreground">{masteries.join(", ")}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(cls)} data-testid={`button-edit-class-${cls.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(cls.id)} data-testid={`button-delete-class-${cls.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!selectedGameSlug && <p className="text-sm text-muted-foreground">Select a game to manage its classes.</p>}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Class</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name</Label>
              <Input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. Sentinel" data-testid="input-class-name" />
            </div>
            <div className="space-y-2">
              <Label>Masteries (comma separated)</Label>
              <Input value={classMasteries} onChange={e => setClassMasteries(e.target.value)} placeholder="e.g. Void Knight, Forge Guard" data-testid="input-class-masteries" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" value={classColor} onChange={e => setClassColor(e.target.value)} data-testid="input-class-color" />
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!className || createMutation.isPending} className="w-full" data-testid="button-create-class">
              Create Class
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editClass} onOpenChange={open => { if (!open) { setEditClass(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Class</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name</Label>
              <Input value={className} onChange={e => setClassName(e.target.value)} data-testid="input-edit-class-name" />
            </div>
            <div className="space-y-2">
              <Label>Masteries (comma separated)</Label>
              <Input value={classMasteries} onChange={e => setClassMasteries(e.target.value)} data-testid="input-edit-class-masteries" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" value={classColor} onChange={e => setClassColor(e.target.value)} />
            </div>
            <Button onClick={() => editClass && updateMutation.mutate(editClass.id)} disabled={updateMutation.isPending} className="w-full" data-testid="button-update-class">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
