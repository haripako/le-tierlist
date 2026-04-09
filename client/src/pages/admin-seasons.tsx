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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowLeft, Shield } from "lucide-react";
import { Link } from "wouter";
import type { Season } from "@shared/schema";

export default function AdminSeasonsPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [editSeason, setEditSeason] = useState<Season | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [patch, setPatch] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  const { data: seasons, isLoading } = useQuery<Season[]>({
    queryKey: ["/api/seasons"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/seasons"); return res.json(); },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/seasons", { adminUserId: user!.id, slug, name, patch, isActive, sortOrder });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
      setShowAdd(false);
      resetForm();
      toast({ title: "Season created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/seasons/${editSeason!.id}`, { adminUserId: user!.id, slug, name, patch, isActive, sortOrder });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasons"] });
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

  function resetForm() {
    setSlug(""); setName(""); setPatch(""); setIsActive(true); setSortOrder(0);
  }

  function openEdit(season: Season) {
    setEditSeason(season);
    setSlug(season.slug);
    setName(season.name);
    setPatch(season.patch);
    setIsActive(season.isActive);
    setSortOrder(season.sortOrder);
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Shield className="w-12 h-12 mx-auto mb-3" />
        <p className="text-lg font-medium">Admin access required</p>
        <Link href="/"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link>
      </div>
    );
  }

  const FormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Slug (unique ID)</Label>
          <Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="s5" data-testid="input-season-slug" />
        </div>
        <div className="space-y-2">
          <Label>Patch Version</Label>
          <Input value={patch} onChange={e => setPatch(e.target.value)} placeholder="1.5" data-testid="input-season-patch" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Season Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Season 5 — New Era" data-testid="input-season-name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Sort Order</Label>
          <Input type="number" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 0)} data-testid="input-season-order" />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-season-active" />
          <Label>Active</Label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
            Manage Seasons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Add, edit, or deactivate game seasons.</p>
        </div>
        <Dialog open={showAdd} onOpenChange={v => { setShowAdd(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-season">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Season
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Season</DialogTitle></DialogHeader>
            <FormFields />
            <Button onClick={() => createMutation.mutate()} disabled={!slug || !name || !patch || createMutation.isPending} className="w-full" data-testid="button-save-season">
              {createMutation.isPending ? "Creating..." : "Create Season"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Season list */}
      <div className="space-y-2">
        {seasons?.map(season => (
          <div key={season.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{season.name}</p>
                <Badge variant={season.isActive ? "default" : "secondary"} className="text-[10px]">
                  {season.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Slug: {season.slug} · Patch: {season.patch} · Order: {season.sortOrder}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(season)} data-testid={`button-edit-season-${season.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(season.id)} className="text-destructive hover:text-destructive"
                data-testid={`button-delete-season-${season.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editSeason} onOpenChange={v => { if (!v) { setEditSeason(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Season</DialogTitle></DialogHeader>
          <FormFields />
          <Button onClick={() => updateMutation.mutate()} disabled={!slug || !name || !patch || updateMutation.isPending} className="w-full">
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
