import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";

export default function SettingsBrands() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ["brands-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (modal.editId) {
        const { error } = await supabase.from("brands").update({ name, is_active: isActive }).eq("id", modal.editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("brands").insert({ name, is_active: isActive });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands-all"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
      setModal({ open: false, editId: null });
      toast({ title: modal.editId ? "Brand updated" : "Brand added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("brands").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands-all"] });
      qc.invalidateQueries({ queryKey: ["brands"] });
    },
  });

  const openAdd = () => { setName(""); setIsActive(true); setModal({ open: true, editId: null }); };
  const openEdit = (brand: any) => { setName(brand.name); setIsActive(brand.is_active); setModal({ open: true, editId: brand.id }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Brands</h2>
          <p className="text-sm text-muted-foreground">Manage product brands</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="h-4 w-4" /> Add Brand</Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : brands.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No brands yet. Add one to get started.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Brand Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand: any) => (
                <tr key={brand.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{brand.name}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={brand.is_active}
                      onCheckedChange={(checked) => toggleActive.mutate({ id: brand.id, is_active: checked })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(brand)}>
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
            <DialogTitle>{modal.editId ? "Edit Brand" : "Add Brand"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Brand Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ open: false, editId: null })}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
