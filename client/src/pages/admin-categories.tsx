import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import type { Category } from "@shared/schema";

export default function AdminCategoriesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);

  const [cName, setCName] = useState("");
  const [cSlug, setCSlug] = useState("");
  const [cIcon, setCIcon] = useState("🎮");
  const [cSort, setCSort] = useState("0");

  const { data: cats, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/categories"); return res.json(); },
  });

  function resetForm() {
    setCName(""); setCSlug(""); setCIcon("🎮"); setCSort("0");
  }

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/categories", {
      adminUserId: user?.id, name: cName, slug: cSlug, icon: cIcon, sortOrder: parseInt(cSort),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category created" });
      resetForm(); setShowAdd(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/categories/${id}`, {
      adminUserId: user?.id, name: cName, slug: cSlug, icon: cIcon, sortOrder: parseInt(cSort),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category updated" });
      setEditCat(null); resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/categories/${id}`, { adminUserId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      toast({ title: "Category deleted, games reassigned to Other" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(cat: Category) {
    setEditCat(cat);
    setCName(cat.name);
    setCSlug(cat.slug);
    setCIcon(cat.icon);
    setCSort(String(cat.sortOrder));
  }

  const CatForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={cName}
            onChange={e => { setCName(e.target.value); if (!editCat) setCSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }}
            placeholder="e.g. ARPG"
            data-testid="input-cat-name"
          />
        </div>
        <div className="space-y-2">
          <Label>Slug *</Label>
          <Input value={cSlug} onChange={e => setCSlug(e.target.value)} placeholder="e.g. arpg" data-testid="input-cat-slug" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Icon (emoji)</Label>
          <Input value={cIcon} onChange={e => setCIcon(e.target.value)} placeholder="🎮" data-testid="input-cat-icon" />
        </div>
        <div className="space-y-2">
          <Label>Sort Order</Label>
          <Input type="number" value={cSort} onChange={e => setCSort(e.target.value)} data-testid="input-cat-sort" />
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout title="Categories">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} data-testid="button-add-category">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Category
          </Button>
        </div>

        <Card data-testid="categories-admin-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" /> Categories ({cats?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-2">
                {(cats ?? []).map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" data-testid={`cat-admin-row-${cat.id}`}>
                    <span className="text-xl shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cat.name}</p>
                      <p className="text-xs text-muted-foreground">slug: {cat.slug} · sort: {cat.sortOrder}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(cat)} data-testid={`button-edit-cat-${cat.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(cat.id)}
                        disabled={deleteMutation.isPending || cat.slug === "other"}
                        data-testid={`button-delete-cat-${cat.id}`}
                        title={cat.slug === "other" ? "Cannot delete the default category" : "Delete"}
                      >
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
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <CatForm />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!cName || !cSlug || createMutation.isPending}
            className="w-full mt-2"
            data-testid="button-create-category"
          >
            Create Category
          </Button>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editCat} onOpenChange={open => { if (!open) { setEditCat(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit: {editCat?.name}</DialogTitle></DialogHeader>
          <CatForm />
          <Button
            onClick={() => editCat && updateMutation.mutate(editCat.id)}
            disabled={updateMutation.isPending}
            className="w-full mt-2"
            data-testid="button-update-category"
          >
            Save Changes
          </Button>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
