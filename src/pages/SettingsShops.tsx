import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";

interface ShopForm {
  name: string;
  type: "SHOP" | "GODOWN";
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
}

const emptyForm: ShopForm = { name: "", type: "SHOP", address: "", city: "", latitude: "", longitude: "", is_active: true };

export default function SettingsShops() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [form, setForm] = useState<ShopForm>(emptyForm);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ["shops-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        type: form.type as any,
        address: form.address || null,
        city: form.city || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        is_active: form.is_active,
      };
      if (modal.editId) {
        const { error } = await supabase.from("shops").update(payload).eq("id", modal.editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shops").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shops-all"] });
      qc.invalidateQueries({ queryKey: ["shops"] });
      setModal({ open: false, editId: null });
      toast({ title: modal.editId ? "Shop updated" : "Shop added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("shops").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shops-all"] });
      qc.invalidateQueries({ queryKey: ["shops"] });
    },
  });

  const openAdd = () => { setForm(emptyForm); setModal({ open: true, editId: null }); };
  const openEdit = (shop: any) => {
    setForm({
      name: shop.name,
      type: shop.type,
      address: shop.address || "",
      city: shop.city || "",
      latitude: shop.latitude?.toString() || "",
      longitude: shop.longitude?.toString() || "",
      is_active: shop.is_active,
    });
    setModal({ open: true, editId: shop.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Shops & Godowns</h2>
          <p className="text-sm text-muted-foreground">Manage your retail shops and storage godowns</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Shop/Godown</Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : shops.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No shops yet. Add one to get started.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Address</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">City</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Lat</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Lng</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop: any) => (
                <tr key={shop.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{shop.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={shop.type === "GODOWN" ? "secondary" : "default"} className="text-xs">
                      {shop.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{shop.address || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{shop.city || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{shop.latitude ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{shop.longitude ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={shop.is_active}
                      onCheckedChange={(checked) => toggleActive.mutate({ id: shop.id, is_active: checked })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(shop)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={modal.open} onOpenChange={(open) => !open && setModal({ open: false, editId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal.editId ? "Edit Shop/Godown" : "Add Shop/Godown"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHOP">Shop</SelectItem>
                    <SelectItem value="GODOWN">Godown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm(f => ({ ...f, latitude: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm(f => ({ ...f, longitude: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ open: false, editId: null })}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
