import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Buyer {
  id: string;
  buyer_number: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export default function Buyers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    notes: "",
  });

  const { data: buyers = [], isLoading } = useQuery<Buyer[]>({
    queryKey: ["buyers-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buyers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        gstin: form.gstin || null,
        notes: form.notes || null,
        is_active: true,
      };

      if (modal.editId) {
        const { error } = await supabase
          .from("buyers")
          .update(payload)
          .eq("id", modal.editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("buyers")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers-all"] });
      queryClient.invalidateQueries({ queryKey: ["buyers-active"] });
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      setModal({ open: false, editId: null });
      toast({ title: modal.editId ? "Buyer updated successfully" : "Buyer added successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error saving buyer", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("buyers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyers-all"] });
      queryClient.invalidateQueries({ queryKey: ["buyers-active"] });
      queryClient.invalidateQueries({ queryKey: ["buyers"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
      setDeleteId(null);
      toast({ title: "Buyer removed successfully", description: "All associated orders and dispatch stops have been deleted." });
    },
    onError: (err: any) => {
      toast({ title: "Error removing buyer", description: err.message, variant: "destructive" });
    },
  });

  const openAdd = () => {
    setForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      gstin: "",
      notes: "",
    });
    setModal({ open: true, editId: null });
  };

  const openEdit = (buyer: Buyer) => {
    setForm({
      name: buyer.name,
      phone: buyer.phone || "",
      email: buyer.email || "",
      address: buyer.address || "",
      gstin: buyer.gstin || "",
      notes: buyer.notes || "",
    });
    setModal({ open: true, editId: buyer.id });
  };

  const filteredBuyers = buyers.filter((b) => {
    const query = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(query) ||
      (b.buyer_number && b.buyer_number.toLowerCase().includes(query)) ||
      (b.phone && b.phone.includes(searchQuery)) ||
      (b.email && b.email.toLowerCase().includes(query)) ||
      (b.address && b.address.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Buyers</h2>
          <p className="text-sm text-muted-foreground">Manage and track your retail and wholesale buyers</p>
        </div>
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-10 border-gray-300 focus-visible:ring-primary"
              placeholder="Search buyers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={openAdd} className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add Buyer
          </Button>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-lg border border-gray-200 bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filteredBuyers.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {searchQuery ? "No buyers match your search query." : "No buyers registered yet. Click 'Add Buyer' to start."}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left bg-muted/30">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Address</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">GSTIN</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuyers.map((buyer) => (
                <tr key={buyer.id} className="border-b border-gray-200 last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-foreground">#{buyer.buyer_number}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">
                    <div>{buyer.name}</div>
                    {buyer.notes && (
                      <div className="text-xs text-muted-foreground font-normal line-clamp-1 mt-0.5" title={buyer.notes}>
                        {buyer.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {buyer.phone && <div>{buyer.phone}</div>}
                    {buyer.email && <div className="text-xs">{buyer.email}</div>}
                    {!buyer.phone && !buyer.email && <span>—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate" title={buyer.address || ""}>
                    {buyer.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                    {buyer.gstin || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(buyer)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(buyer.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Remove Buyer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={modal.open} onOpenChange={(open) => !open && setModal({ open: false, editId: null })}>
        <DialogContent className="sm:max-w-lg border border-gray-200">
          <DialogHeader>
            <DialogTitle>{modal.editId ? "Edit Buyer" : "Add New Buyer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Yash Agency"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. yash@agency.com"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="gstin">GSTIN (optional)</Label>
              <Input
                id="gstin"
                value={form.gstin}
                onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Shop number, market, street..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes / Special Instructions</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any special pricing agreements, default slot, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-300" onClick={() => setModal({ open: false, editId: null })}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Buyer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this buyer? This will delete the buyer record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
