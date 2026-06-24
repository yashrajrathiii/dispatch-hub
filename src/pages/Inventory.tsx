import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle, XCircle, Plus, MoreHorizontal, AlertTriangle, Pencil, History, Trash2, Search, Filter } from "lucide-react";
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

function computeCB(pcs: number, ppb: number | null | undefined): string {
  if (!ppb || ppb <= 0) return "—";
  return (pcs / ppb).toFixed(2);
}

function changeTypeBadge(type: string) {
  const map: Record<string, string> = {
    RECEIVED: "bg-success/10 text-success",
    SOLD: "bg-destructive/10 text-destructive",
    ADJUSTED: "bg-warning/10 text-warning",
    DISPATCHED: "bg-blue-500/10 text-blue-500",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[type] || "bg-muted text-muted-foreground"}`}>
      {type}
    </span>
  );
}

const getSingularUnit = (unit: string) => {
  if (!unit) return "Box";
  if (unit.toLowerCase() === "cb") return "Box";
  if (unit.toLowerCase().endsWith("s")) return unit.slice(0, -1);
  return unit;
};

export default function Inventory() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [shopFilter, setShopFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Combined edit/adjust modal
  const [editModal, setEditModal] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editPpb, setEditPpb] = useState("");
  const [editQtyChange, setEditQtyChange] = useState("");
  const [editQtyChangeCb, setEditQtyChangeCb] = useState("");
  const [editNote, setEditNote] = useState("");

  // Dynamic unit list
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const unitOptions = useMemo(() => {
    const baseUnits = ["CB", "Bags"];
    const dbUnits = inventory
      .map((item: any) => item.product?.unit)
      .filter((u: string) => u && !baseUnits.includes(u));
    return Array.from(new Set([...baseUnits, ...dbUnits, ...customUnits]));
  }, [inventory, customUnits]);

  // History panel
  const [historyPanel, setHistoryPanel] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });

  // Add product
  const [addModal, setAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", brand_id: "", unit: "CB", shop_id: "", quantity: "0", pieces_per_box: "" });

  // Global logs modal & filters
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logShopFilter, setLogShopFilter] = useState("all");
  const [logTypeFilter, setLogTypeFilter] = useState("all");

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
      const { data } = await supabase.from("shops").select("*").eq("is_active", true).is("deleted_at", null);
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

  // History query
  const { data: historyLogs = [] } = useQuery({
    queryKey: ["inventory-logs", historyPanel.item?.product_id, historyPanel.item?.shop_id],
    enabled: !!historyPanel.item,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_logs")
        .select("*, user:users!inventory_logs_created_by_user_id_fkey(name)")
        .eq("product_id", historyPanel.item.product_id)
        .eq("shop_id", historyPanel.item.shop_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Global activity logs query
  const { data: globalLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["global-inventory-logs"],
    enabled: logsModalOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_logs")
        .select("*, product:products(name), shop:shops(name), user:users!inventory_logs_created_by_user_id_fkey(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Global logs in-memory filtering
  const filteredLogs = globalLogs.filter((log: any) => {
    if (logShopFilter !== "all" && log.shop_id !== logShopFilter) return false;
    if (logTypeFilter !== "all" && log.change_type !== logTypeFilter) return false;
    if (logSearch) {
      const s = logSearch.toLowerCase();
      const productName = log.product?.name?.toLowerCase() || "";
      const userName = log.user?.name?.toLowerCase() || "";
      const note = log.note?.toLowerCase() || "";
      if (!productName.includes(s) && !userName.includes(s) && !note.includes(s)) {
        return false;
      }
    }
    return true;
  });

  const openEditModal = (item: any) => {
    setEditName(item.product?.name || "");
    setEditUnit(item.product?.unit || "CB");
    setEditPpb(item.product?.pieces_per_box?.toString() || "");
    setEditQtyChange("");
    setEditQtyChangeCb("");
    setEditNote("");
    setEditModal({ open: true, item });
  };

  const handleQtyChange = (val: string) => {
    setEditQtyChange(val);
    const ppbNum = Number(editPpb);
    if (ppbNum > 0 && val) {
      setEditQtyChangeCb((Number(val) / ppbNum).toFixed(2));
    } else {
      setEditQtyChangeCb("");
    }
  };

  const handleQtyChangeCb = (val: string) => {
    setEditQtyChangeCb(val);
    const ppbNum = Number(editPpb);
    if (ppbNum > 0 && val) {
      setEditQtyChange(Math.round(Number(val) * ppbNum).toString());
    } else {
      setEditQtyChange("");
    }
  };

  const handlePpbChange = (val: string) => {
    setEditPpb(val);
    const ppbNum = Number(val);
    if (ppbNum > 0 && editQtyChange) {
      setEditQtyChangeCb((Number(editQtyChange) / ppbNum).toFixed(2));
    } else {
      setEditQtyChangeCb("");
    }
  };

  const saveEdit = useMutation({
    mutationFn: async () => {
      const item = editModal.item;
      if (!item || !appUser) return;
      const change = Number(editQtyChange) || 0;

      // Update product name, unit, and pieces_per_box if changed
      const newPpb = editPpb ? Number(editPpb) : null;
      const nameChanged = editName.trim() && editName.trim() !== item.product?.name;
      const unitChanged = editUnit && editUnit !== item.product?.unit;
      const ppbChanged = newPpb !== (item.product?.pieces_per_box ?? null);
      
      if (nameChanged || unitChanged || ppbChanged) {
        const updatePayload: any = {};
        if (nameChanged) updatePayload.name = editName.trim();
        if (unitChanged) updatePayload.unit = editUnit;
        if (ppbChanged) updatePayload.pieces_per_box = newPpb;
        
        const { error: pErr } = await supabase.from("products").update(updatePayload).eq("id", item.product_id);
        if (pErr) throw pErr;
      }

      if (change !== 0) {
        const newQty = Number(item.quantity) + change;
        const { error: invErr } = await supabase
          .from("inventory")
          .update({ quantity: newQty, last_updated_at: new Date().toISOString(), updated_by_user_id: appUser.id })
          .eq("id", item.id);
        if (invErr) throw invErr;

        const { error: logErr } = await supabase.from("inventory_logs").insert({
          shop_id: item.shop_id,
          product_id: item.product_id,
          change_type: (change > 0 ? "RECEIVED" : "ADJUSTED") as any,
          quantity_change: change,
          note: editNote,
          created_by_user_id: appUser.id,
        });
        if (logErr) throw logErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditModal({ open: false, item: null });
      toast({ title: "Saved" });
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

        if (Number(newProduct.quantity) > 0) {
          await supabase.from("inventory_logs").insert({
            shop_id: newProduct.shop_id,
            product_id: prod.id,
            change_type: "RECEIVED" as any,
            quantity_change: Number(newProduct.quantity),
            note: "Initial stock",
            created_by_user_id: appUser.id,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAddModal(false);
      setNewProduct({ name: "", brand_id: "", unit: "CB", shop_id: "", quantity: "0", pieces_per_box: "" });
      toast({ title: "Product added successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteProduct = useMutation({
    mutationFn: async (item: any) => {
      const productId = item.product_id;

      // 1. Delete associated product prices
      const { error: priceErr } = await supabase
        .from("product_prices")
        .delete()
        .eq("product_id", productId);
      if (priceErr) throw priceErr;

      // 2. Delete associated inventory logs
      const { error: logErr } = await supabase
        .from("inventory_logs")
        .delete()
        .eq("product_id", productId);
      if (logErr) throw logErr;

      // 3. Delete associated inventory entries
      const { error: invErr } = await supabase
        .from("inventory")
        .delete()
        .eq("product_id", productId);
      if (invErr) throw invErr;

      // 4. Finally, try to hard delete the product
      const { error: prodErr } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (prodErr) {
        // If referenced in order history (foreign key constraint error)
        if (prodErr.code === "23503") {
          // Fall back to soft delete to preserve order history integrity while removing from active views
          const { error: softErr } = await supabase
            .from("products")
            .update({ is_active: false })
            .eq("id", productId);
          if (softErr) throw softErr;
          console.log("Product has active order history. Soft-deleted and removed from inventory lists.");
        } else {
          throw prodErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Product successfully deleted and removed from active inventory" });
    },
    onError: (err: any) => {
      toast({
        title: "Error deleting product",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const filtered = inventory.filter((item: any) => {
    if (item.shop?.type !== "GODOWN") return false;
    if (shopFilter !== "all" && item.shop_id !== shopFilter) return false;
    if (brandFilter !== "all" && item.product?.brand_id !== brandFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!item.product?.name?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const totalSKUs = filtered.length;
  const inStockCount = filtered.filter((i: any) => Number(i.quantity) > 0).length;
  const outOfStock = filtered.filter((i: any) => Number(i.quantity) === 0).length;

  const canAdd = appUser?.role.includes("OWNER") || appUser?.role.includes("ADMIN");

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header and Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Inventory</h2>
            <p className="text-sm text-muted-foreground">Monitor and manage product stock levels across godowns</p>
          </div>
          {appUser?.role.includes("OWNER") && (
            <div className="flex items-center gap-3 ml-auto">
              <Button onClick={() => setLogsModalOpen(true)} className="gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground" variant="outline">
                <History className="h-4 w-4" /> Logs
              </Button>
            </div>
          )}
        </div>

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
            <SelectTrigger className="w-48"><SelectValue placeholder="All Godowns" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Godowns</SelectItem>
              {godowns.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Godown</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">QTY (Pcs)</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">QTY (Pack)</th>
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
                  const productUnit = item.product?.unit || "CB";
                  const missingPpb = !ppb || ppb <= 0;
                  const singularUnit = getSingularUnit(productUnit);
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
                              <button onClick={() => openEditModal(item)} className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span className="text-xs">Set Pcs/{singularUnit}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Set Pieces per {singularUnit} to calculate {productUnit}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span>{cbValue} {productUnit}</span>
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
                            <DropdownMenuItem onClick={() => openEditModal(item)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit / Adjust Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setHistoryPanel({ open: true, item })}>
                              <History className="mr-2 h-4 w-4" /> Stock History
                            </DropdownMenuItem>
                            {appUser?.role.includes("OWNER") && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete "${item.product?.name}"? This will remove it from inventory and price lists.`)) {
                                    deleteProduct.mutate(item);
                                  }
                                }}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Product
                              </DropdownMenuItem>
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

        <Dialog open={editModal.open} onOpenChange={(open) => !open && setEditModal({ open: false, item: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Product / Adjust Stock</DialogTitle>
              <p className="text-sm text-muted-foreground">{editModal.item?.product?.brand?.name || "No brand"}</p>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  placeholder="Product name" 
                  disabled={!canAdd} 
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <div className="flex gap-2">
                  <Select value={editUnit} onValueChange={setEditUnit} disabled={!canAdd}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    disabled={!canAdd}
                    onClick={() => {
                      const nu = prompt("Enter new unit name:");
                      if (nu && nu.trim()) {
                        const cleanNu = nu.trim();
                        if (!unitOptions.includes(cleanNu)) {
                          setCustomUnits(prev => [...prev, cleanNu]);
                        }
                        setEditUnit(cleanNu);
                      }
                    }}
                    title="Add custom unit"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pieces per {getSingularUnit(editUnit)} ({editUnit})</Label>
                <Input type="number" value={editPpb} onChange={(e) => handlePpbChange(e.target.value)} placeholder="e.g. 20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity Change in Pieces</Label>
                  <Input type="number" value={editQtyChange} onChange={(e) => handleQtyChange(e.target.value)} placeholder="e.g. 50 or -20" />
                </div>
                <div className="space-y-2">
                  <Label>Quantity Change in {editUnit}</Label>
                  <Input 
                    type="number" 
                    value={editQtyChangeCb} 
                    onChange={(e) => handleQtyChangeCb(e.target.value)} 
                    placeholder={editPpb ? `e.g. 2.5 or -1` : `Set Pcs/${getSingularUnit(editUnit)} first`}
                    disabled={!editPpb || Number(editPpb) <= 0}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Positive to add, negative to remove. Changing either field updates the other automatically based on Pieces per Box.
              </p>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Reason for adjustment (optional)..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditModal({ open: false, item: null })}>Cancel</Button>
              <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                {saveEdit.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stock History Panel */}
        <Sheet open={historyPanel.open} onOpenChange={(o) => !o && setHistoryPanel({ open: false, item: null })}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Stock History — {historyPanel.item?.product?.name}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              {historyLogs.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">No stock history yet</div>
              ) : historyLogs.map((log: any) => {
                const change = Number(log.quantity_change);
                return (
                  <div key={log.id} className="rounded-md border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                      {changeTypeBadge(log.change_type)}
                    </div>
                    <div className={`text-sm font-semibold ${change >= 0 ? "text-success" : "text-destructive"}`}>
                      {change > 0 ? `+${change}` : change} pcs
                    </div>
                    {log.note && <p className="text-xs italic text-muted-foreground">{log.note}</p>}
                    <p className="text-xs text-muted-foreground">By {log.user?.name || "—"}</p>
                  </div>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>

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
                  <Label>Unit</Label>
                  <div className="flex gap-2">
                    <Select value={newProduct.unit} onValueChange={(v) => setNewProduct(p => ({ ...p, unit: v }))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {unitOptions.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={() => {
                        const nu = prompt("Enter new unit name:");
                        if (nu && nu.trim()) {
                          const cleanNu = nu.trim();
                          if (!unitOptions.includes(cleanNu)) {
                            setCustomUnits(prev => [...prev, cleanNu]);
                          }
                          setNewProduct(p => ({ ...p, unit: cleanNu }));
                        }
                      }}
                      title="Add custom unit"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pieces per {getSingularUnit(newProduct.unit)} ({newProduct.unit})</Label>
                  <Input type="number" value={newProduct.pieces_per_box} onChange={(e) => setNewProduct(p => ({ ...p, pieces_per_box: e.target.value }))} placeholder="e.g. 20" />
                </div>
                <div className="space-y-2">
                  <Label>Quantity (Pieces)</Label>
                  <Input type="number" value={newProduct.quantity} onChange={(e) => setNewProduct(p => ({ ...p, quantity: e.target.value }))} />
                </div>
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
              <Button onClick={() => addProduct.mutate()} disabled={!newProduct.name || addProduct.isPending}>
                {addProduct.isPending ? "Adding..." : "Add Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Global Activity Logs Modal */}
        <Dialog open={logsModalOpen} onOpenChange={setLogsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Inventory Activity Logs
              </DialogTitle>
              <p className="text-sm text-muted-foreground">Review history of stock changes made by staff and other users.</p>
            </DialogHeader>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 my-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder="Search by product, user, or note..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                />
              </div>
              <Select value={logShopFilter} onValueChange={setLogShopFilter}>
                <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Godowns" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Godowns</SelectItem>
                  {godowns.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All Actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="RECEIVED">RECEIVED</SelectItem>
                  <SelectItem value="SOLD">SOLD</SelectItem>
                  <SelectItem value="ADJUSTED">ADJUSTED</SelectItem>
                  <SelectItem value="DISPATCHED">DISPATCHED</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto min-h-[300px] border border-border rounded-md">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground">No matching activity logs found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10 border-b border-border">
                    <tr className="text-left bg-muted/40 text-muted-foreground font-semibold">
                      <th className="px-4 py-2 text-xs uppercase">Date & Time</th>
                      <th className="px-4 py-2 text-xs uppercase">User</th>
                      <th className="px-4 py-2 text-xs uppercase">Action</th>
                      <th className="px-4 py-2 text-xs uppercase">Product</th>
                      <th className="px-4 py-2 text-xs uppercase">Godown</th>
                      <th className="px-4 py-2 text-xs uppercase text-right">Change</th>
                      <th className="px-4 py-2 text-xs uppercase">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log: any) => {
                      const change = Number(log.quantity_change);
                      return (
                        <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true
                            })}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">
                            {log.user?.name || "System"}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {changeTypeBadge(log.change_type)}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-foreground max-w-[150px] truncate" title={log.product?.name}>
                            {log.product?.name || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground truncate" title={log.shop?.name}>
                            {log.shop?.name || "—"}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${change >= 0 ? "text-success" : "text-destructive"}`}>
                            {change > 0 ? `+${change}` : change} pcs
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground italic max-w-[150px] truncate" title={log.note || ""}>
                            {log.note || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={() => setLogsModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
