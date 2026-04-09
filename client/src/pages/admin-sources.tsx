import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Globe, Youtube, MessageCircle, ExternalLink } from "lucide-react";
import type { GameWithMeta } from "@shared/schema";

type BuildSource = {
  id: number;
  name: string;
  type: string;
  url: string;
  gameId: number | null;
  isActive: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
};

function getTypeIcon(type: string) {
  switch (type) {
    case "youtube_channel": return <Youtube className="w-3.5 h-3.5" />;
    case "reddit": return <MessageCircle className="w-3.5 h-3.5" />;
    default: return <Globe className="w-3.5 h-3.5" />;
  }
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case "youtube_channel": return "text-red-400 bg-red-400/10 border-red-400/20";
    case "reddit": return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    default: return "text-blue-400 bg-blue-400/10 border-blue-400/20";
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "youtube_channel": return "YouTube";
    case "reddit": return "Reddit";
    default: return "Website";
  }
}

const EMPTY_FORM = { name: "", type: "website", url: "", gameId: "", isActive: true };

export default function AdminSourcesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<BuildSource | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: sources, isLoading } = useQuery<BuildSource[]>({
    queryKey: ["/api/admin/sources", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/sources?adminUserId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: games } = useQuery<GameWithMeta[]>({
    queryKey: ["/api/games"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/games");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/sources", {
        adminUserId: user?.id,
        name: form.name,
        type: form.type,
        url: form.url,
        gameId: form.gameId ? parseInt(form.gameId) : null,
        isActive: form.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] });
      toast({ title: "Source added" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "Failed to add source", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingSource) return;
      const res = await apiRequest("PATCH", `/api/admin/sources/${editingSource.id}`, {
        adminUserId: user?.id,
        name: form.name,
        type: form.type,
        url: form.url,
        gameId: form.gameId ? parseInt(form.gameId) : null,
        isActive: form.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] });
      toast({ title: "Source updated" });
      setDialogOpen(false);
      setEditingSource(null);
      setForm(EMPTY_FORM);
    },
    onError: () => toast({ title: "Failed to update source", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/sources/${id}`, {
        adminUserId: user?.id,
        isActive,
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/sources/${id}?adminUserId=${user?.id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] });
      toast({ title: "Source removed" });
    },
  });

  const openAdd = () => {
    setEditingSource(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (source: BuildSource) => {
    setEditingSource(source);
    setForm({
      name: source.name,
      type: source.type,
      url: source.url,
      gameId: source.gameId ? String(source.gameId) : "",
      isActive: source.isActive,
    });
    setDialogOpen(true);
  };

  const getGameName = (gameId: number | null) => {
    if (!gameId) return "All Games";
    return games?.find(g => g.id === gameId)?.name ?? `Game #${gameId}`;
  };

  const groupedSources = sources ? {
    website: sources.filter(s => s.type === "website"),
    youtube_channel: sources.filter(s => s.type === "youtube_channel"),
    reddit: sources.filter(s => s.type === "reddit"),
  } : {};

  return (
    <AdminLayout title="Build Sources">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Reference directory of sources for discovering new builds. Not auto-crawled — use these links to manually find builds to add.
          </p>
          <Button size="sm" onClick={openAdd} className="gap-1.5 shrink-0" data-testid="button-add-source">
            <Plus className="w-3.5 h-3.5" /> Add Source
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-6">
            {(["website", "youtube_channel", "reddit"] as const).map(type => {
              const typeSources = (groupedSources[type] ?? []) as BuildSource[];
              if (typeSources.length === 0) return null;
              return (
                <section key={type} className="space-y-2">
                  <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border ${getTypeBadgeColor(type)}`}>
                    {getTypeIcon(type)}
                    {getTypeLabel(type)} ({typeSources.length})
                  </div>
                  <div className="space-y-1.5">
                    {typeSources.map(source => (
                      <div
                        key={source.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                        data-testid={`source-row-${source.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{source.name}</span>
                            <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                              {getGameName(source.gameId)}
                            </span>
                            {!source.isActive && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                            )}
                          </div>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary/70 hover:text-primary truncate flex items-center gap-1 mt-0.5"
                            data-testid={`link-source-url-${source.id}`}
                          >
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{source.url}</span>
                          </a>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={source.isActive}
                            onCheckedChange={v => toggleMutation.mutate({ id: source.id, isActive: v })}
                            data-testid={`toggle-source-${source.id}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(source)}
                            data-testid={`button-edit-source-${source.id}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(source.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-source-${source.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => {
        setDialogOpen(open);
        if (!open) { setEditingSource(null); setForm(EMPTY_FORM); }
      }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{editingSource ? "Edit Source" : "Add Build Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="source-name">Source Name *</Label>
              <Input
                id="source-name"
                placeholder="e.g. Maxroll Last Epoch"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-source-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="select-source-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="youtube_channel">YouTube Channel</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-url">URL *</Label>
              <Input
                id="source-url"
                placeholder="https://..."
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                data-testid="input-source-url"
              />
            </div>
            <div className="space-y-2">
              <Label>Game (optional)</Label>
              <Select value={form.gameId} onValueChange={v => setForm(f => ({ ...f, gameId: v }))}>
                <SelectTrigger data-testid="select-source-game">
                  <SelectValue placeholder="All Games" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Games</SelectItem>
                  {games?.map(g => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
                data-testid="toggle-source-active"
              />
              <Label>Active</Label>
            </div>
            <Button
              className="w-full"
              onClick={() => editingSource ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!form.name || !form.url || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-source"
            >
              {editingSource ? "Save Changes" : "Add Source"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
