import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle, XCircle, Plus, Pencil, Trash2, MoreHorizontal, ArrowUpDown, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function StockBadge({ qty }: { qty: number }) {
  const inStock = qty > 0;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      inStock ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
    }`}>
      {inStock ? "In Stock" : "Out of Stock"}
    </span>
  );
}

function computeCB(pcs: number, piecesPerBox: number | null | undefined): string {
  if (!piecesPerBox || piecesPerBox <= 0) return "—";
  return (pcs / piecesPerBox).toFixed(2);
}

export default function Inventory() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [shopFilter, setShopFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [adjustModal, setAdjustModal] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const [adjustType, setAdjustType] = useState<string>("RECEIVED");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const [addModal, setAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", brand_id: "", unit: "pcs", shop_id: "", quantity: "0", pieces_per_box: "" });
  const [editModal, setEditModal] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const [editFields, setEditFields] = useState({ name: "", brand_id: "", pieces_per_box: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });

  // Quick edit pieces_per_box
  const [ppbModal, setPpbModal] = useState<{ open: boolean; product: any | null }>({ open: false, product: null });
  const [ppbValue, setPpbValue] = useState("");

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*, product:products(*,brand:brands(*)), shop:shops(*)");
      if (error) throw error;
      return data;
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["shops"],
    queryFn: async () => {
      const { data } = await supabase.from("shops").select("*").eq("is_active", true);
      return data || [];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").eq("is_active", true);
      return data || [];
    },
  });

  const godowns = shops.filter((s: any) => s.type === "GODOWN");

  const editProduct = useMutation({
    mutationFn: async () => {
      const item = editModal.item;
      if (!item) return;
      const sku = `${editFields.name.substring(0, 3).toUpperCase()}-${item.product_id.slice(-6)}`;
      const { error } = await supabase.from("products").update({
        name: editFields.name,
        sku,
        brand_id: editFields.brand_id || null,
        pieces_per_box: editFields.pieces_per_box ? Number(editFields.pieces_per_box) : null,
      }).eq("id", item.product_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditModal({ open: false, item: null });
      toast({ title: "Product updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePpb = useMutation({
    mutationFn: async () => {
      const product = ppbModal.product;
      if (!product || !ppbValue) return;
      const { error } = await supabase.from("products").update({
        pieces_per_box: Number(ppbValue),
      }).eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setPpbModal({ open: false, product: null });
      setPpbValue("");
      toast({ title: "Pieces per box updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteInventory = useMutation({
    mutationFn: async (item: any) => {
      const { error: invErr } = await supabase.from("inventory").delete().eq("id", item.id);
      if (invErr) throw invErr;
      const { error: prodErr } = await supabase.from("products").update({ is_active: false }).eq("id", item.product_id);
      if (prodErr) throw prodErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setDeleteConfirm({ open: false, item: null });
      toast({ title: "Inventory item deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEditModal = (item: any) => {
    setEditFields({
      name: item.product?.name || "",
      brand_id: item.product?.brand_id || "",
      pieces_per_box: item.product?.pieces_per_box?.toString() || "",
    });
    setEditModal({ open: true, item });
  };

  const adjustStock = useMutation({
    mutationFn: async () => {
      const item = adjustModal.item;
      if (!item || !appUser) return;
      const change = Number(adjustQty);
      const newQty = Number(item.quantity) + change;

      const { error: invErr } = await supabase
        .from("inventory")
        .update({ quantity: newQty, last_updated_at: new Date().toISOString(), updated_by_user_id: appUser.id })
        .eq("id", item.id);
      if (invErr) throw invErr;

      const { error: logErr } = await supabase.from("inventory_logs").insert({
        shop_id: item.shop_id,
        product_id: item.product_id,
        change_type: adjustType as any,
        quantity_change: change,
        note: adjustNote || null,
        created_by_user_id: appUser.id,
      });
      if (logErr) throw logErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAdjustModal({ open: false, item: null });
      setAdjustQty("");
      setAdjustNote("");
      toast({ title: "Stock adjusted successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      if (!appUser) return;
      const sku = `${newProduct.name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const { data: prod, error: prodErr } = await supabase.from("products").insert({
        name: newProduct.name,
        sku,
        brand_id: newProduct.brand_id || null,
        unit: newProduct.unit,
        pieces_per_box: newProduct.pieces_per_box ? Number(newProduct.pieces_per_box) : null,
      }).select().single();
      if (prodErr) throw prodErr;

      if (newProduct.shop_id) {
        const { error: invErr } = await supabase.from("inventory").insert({
          shop_id: newProduct.shop_id,
          product_id: prod.id,
          quantity: Number(newProduct.quantity),
          min_threshold: 0,
          updated_by_user_id: appUser.id,
        });
        if (invErr) throw invErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAddModal(false);
      setNewProduct({ name: "", brand_id: "", unit: "pcs", shop_id: "", quantity: "0", pieces_per_box: "" });
      toast({ title: "Product added successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = inventory.filter((item: any) => {
    if (shopFilter !== "all" && item.shop_id !== shopFilter) return false;
    if (brandFilter !== "all" && item.product?.brand_id !== brandFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!item.product?.name?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const totalSKUs = inventory.length;
  const inStockCount = inventory.filter((i: any) => Number(i.quantity) > 0).length;
  const outOfStock = inventory.filter((i: any) => Number(i.quantity) === 0).length;

  const canAdd = appUser?.role === "OWNER" || appUser?.role === "ADMIN";

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total SKUs</p>
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{totalSKUs}</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-success">In Stock Items</p>
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <p className="mt-2 text-3xl font-bold text-success">{inStockCount}</p>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-destructive">Out of Stock</p>
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <p className="mt-2 text-3xl font-bold text-destructive">{outOfStock}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={shopFilter} onValueChange={setShopFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Shops" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shops</SelectItem>
              {shops.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All Brands" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Search product..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
          {canAdd && (
            <Button onClick={() => setAddModal(true)} className="ml-auto gap-2">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No inventory items found. Add products to get started.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Brand</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Shop</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">QTY (Pcs)</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">QTY (CB)</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Last Updated</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => {
                  const qty = Number(item.quantity);
                  const ppb = item.product?.pieces_per_box;
                  const cbValue = computeCB(qty, ppb);
                  const missingPpb = !ppb || ppb <= 0;
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{item.product?.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.product?.brand?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.shop?.name}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${qty === 0 ? "text-destructive" : "text-foreground"}`}>
                        {qty}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-muted-foreground">
                        {missingPpb ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  setPpbValue("");
                                  setPpbModal({ open: true, product: item.product });
                                }}
                                className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span className="text-xs">Set Pcs/Box</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Set Pieces per Box to calculate CB</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span>{cbValue} CB</span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StockBadge qty={qty} /></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(item.last_updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setAdjustModal({ open: true, item })}>
                              <ArrowUpDown className="mr-2 h-4 w-4" /> Adjust Stock
                            </DropdownMenuItem>
                            {canAdd && (
                              <>
                                <DropdownMenuItem onClick={() => openEditModal(item)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit Product
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm({ open: true, item })}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Adjust Stock Modal */}
        <Dialog open={adjustModal.open} onOpenChange={(open) => !open && setAdjustModal({ open: false, item: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock — {adjustModal.item?.product?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={adjustType} onValueChange={setAdjustType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="ADJUSTED">Adjusted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity Change (Pieces)</Label>
                <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="e.g. 50 or -10" />
                <p className="text-xs text-muted-foreground">Positive to add, negative to deduct. Enter value in pieces.</p>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Optional note..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustModal({ open: false, item: null })}>Cancel</Button>
              <Button onClick={() => adjustStock.mutate()} disabled={!adjustQty || adjustStock.isPending}>
                {adjustStock.isPending ? "Saving..." : "Save Adjustment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Product Modal */}
        <Dialog open={addModal} onOpenChange={setAddModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input value={newProduct.name} onChange={(e) => setNewProduct(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select value={newProduct.brand_id} onValueChange={(v) => setNewProduct(p => ({ ...p, brand_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                    <SelectContent>
                      {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pieces per Box (CB)</Label>
                  <Input type="number" value={newProduct.pieces_per_box} onChange={(e) => setNewProduct(p => ({ ...p, pieces_per_box: e.target.value }))} placeholder="e.g. 20" />
                  <p className="text-xs text-muted-foreground">How many pieces in 1 carton box?</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity (Pieces)</Label>
                  <Input type="number" value={newProduct.quantity} onChange={(e) => setNewProduct(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Godown</Label>
                  <Select value={newProduct.shop_id} onValueChange={(v) => setNewProduct(p => ({ ...p, shop_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                    <SelectContent>
                      {godowns.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
              <Button onClick={() => addProduct.mutate()} disabled={!newProduct.name || addProduct.isPending}>
                {addProduct.isPending ? "Adding..." : "Add Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Product Modal */}
        <Dialog open={editModal.open} onOpenChange={(open) => !open && setEditModal({ open: false, item: null })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input value={editFields.name} onChange={(e) => setEditFields(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={editFields.brand_id} onValueChange={(v) => setEditFields(p => ({ ...p, brand_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>
                    {brands.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pieces per Box (CB)</Label>
                <Input type="number" value={editFields.pieces_per_box} onChange={(e) => setEditFields(p => ({ ...p, pieces_per_box: e.target.value }))} placeholder="e.g. 20" />
                <p className="text-xs text-muted-foreground">How many pieces in 1 carton box?</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModal({ open: false, item: null })}>Cancel</Button>
              <Button onClick={() => editProduct.mutate()} disabled={!editFields.name || editProduct.isPending}>
                {editProduct.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Set Pieces per Box Modal */}
        <Dialog open={ppbModal.open} onOpenChange={(open) => !open && setPpbModal({ open: false, product: null })}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Set Pieces per Box</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                Product: <span className="font-medium text-foreground">{ppbModal.product?.name}</span>
              </p>
              <div className="space-y-2">
                <Label>How many pieces are in 1 box (CB)?</Label>
                <Input type="number" value={ppbValue} onChange={(e) => setPpbValue(e.target.value)} placeholder="e.g. 20" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPpbModal({ open: false, product: null })}>Cancel</Button>
              <Button onClick={() => updatePpb.mutate()} disabled={!ppbValue || updatePpb.isPending}>
                {updatePpb.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, item: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteConfirm.item?.product?.name}</strong> from inventory? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteConfirm.item && deleteInventory.mutate(deleteConfirm.item)}
              >
                {deleteInventory.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
