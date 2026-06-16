import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, MoreHorizontal, Trash2, Camera, X, Pencil, Check } from "lucide-react";

const statusToBadge: Record<string, any> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  DISPATCHED: "dispatched",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  PICKED_UP: "picked_up",
};
const paymentToBadge: Record<string, any> = {
  PENDING: "pending",
  PARTIAL: "partial",
  PAID: "paid",
};

export default function Orders() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [shopFilter, setShopFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Create order state
  const [isNewBuyer, setIsNewBuyer] = useState(false);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [newBuyer, setNewBuyer] = useState({ name: "", phone: "", email: "", category: "RETAILER" as "DEALER" | "RETAILER" | "WALKIN" });
  const [orderShopId, setOrderShopId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [orderItems, setOrderItems] = useState<Array<{ product_id: string; product_search: string; qty: string; unit_price: number; available: number | null; price_editable: boolean }>>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [notesPhotoFile, setNotesPhotoFile] = useState<File | null>(null);
  const [notesPhotoPreview, setNotesPhotoPreview] = useState<string | null>(null);

  // Data queries
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", appUser?.id, appUser?.role],
    enabled: !!appUser,
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, buyer:buyers(*), shop:shops(*), created_by:users!orders_created_by_user_id_fkey(*)")
        .order("created_at", { ascending: false });

      if (appUser?.role === "SALESMAN") {
        query = query.eq("created_by_user_id", appUser.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["shops-active"],
    queryFn: async () => {
      const { data } = await supabase.from("shops").select("*").eq("is_active", true).is("deleted_at", null);
      return data || [];
    },
  });

  const godowns = shops.filter((s: any) => s.type === "GODOWN");

  const { data: buyers = [] } = useQuery({
    queryKey: ["buyers-active"],
    queryFn: async () => {
      const { data } = await supabase.from("buyers").select("*").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, brand:brands(*)").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: activePrices = [] } = useQuery({
    queryKey: ["active-prices-for-orders"],
    queryFn: async () => {
      const { data: activeList } = await supabase
        .from("price_lists")
        .select("id")
        .eq("is_active", true)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!activeList) return [];
      const { data } = await supabase.from("product_prices").select("*").eq("price_list_id", activeList.id);
      return data || [];
    },
  });

  const { data: inventoryData = [] } = useQuery({
    queryKey: ["inventory-for-orders", orderShopId],
    enabled: !!orderShopId,
    queryFn: async () => {
      const { data } = await supabase.from("inventory").select("*").eq("shop_id", orderShopId);
      return data || [];
    },
  });

  // Filter orders
  const filtered = orders.filter((o: any) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (shopFilter !== "all" && o.shop_id !== shopFilter) return false;
    return true;
  });

  // Get buyer category for pricing
  const getBuyerCategory = (): string => {
    if (isNewBuyer) return newBuyer.category;
    const buyer = buyers.find((b: any) => b.id === selectedBuyerId);
    return buyer?.category || "RETAILER";
  };

  const getPrice = (productId: string): number => {
    const cat = getBuyerCategory();
    const price = activePrices.find((p: any) => p.product_id === productId && p.buyer_category === cat);
    return price ? Number(price.price_per_unit) : 0;
  };

  const getAvailable = (productId: string): number | null => {
    if (!orderShopId) return null;
    const inv = inventoryData.find((i: any) => i.product_id === productId);
    return inv ? Number(inv.quantity) : 0;
  };

  const addItemRow = () => {
    setOrderItems([...orderItems, { product_id: "", product_search: "", qty: "1", unit_price: 0, available: null, price_editable: false }]);
  };

  const selectProduct = (idx: number, product: any) => {
    const price = getPrice(product.id);
    const avail = getAvailable(product.id);
    setOrderItems((items) =>
      items.map((item, i) => (i === idx ? { ...item, product_id: product.id, product_search: product.name, unit_price: price, available: avail, price_editable: false } : item))
    );
  };

  const updateItemSearch = (idx: number, search: string) => {
    setOrderItems((items) => items.map((item, i) => (i === idx ? { ...item, product_search: search, product_id: search ? item.product_id : "", available: search ? item.available : null } : item)));
  };

  const updateItemQty = (idx: number, qty: string) => {
    setOrderItems((items) => items.map((item, i) => (i === idx ? { ...item, qty } : item)));
  };

  const updateItemPrice = (idx: number, price: number) => {
    setOrderItems((items) => items.map((item, i) => (i === idx ? { ...item, unit_price: price } : item)));
  };

  const togglePriceEdit = (idx: number) => {
    setOrderItems((items) => items.map((item, i) => (i === idx ? { ...item, price_editable: !item.price_editable } : item)));
  };

  const removeItem = (idx: number) => {
    setOrderItems((items) => items.filter((_, i) => i !== idx));
  };

  const runningTotal = orderItems.reduce((sum, item) => sum + Number(item.qty) * item.unit_price, 0);

  const filteredBuyers = useMemo(() => {
    if (!buyerSearch) return [];
    const q = buyerSearch.toLowerCase();
    return buyers.filter((b: any) => b.name.toLowerCase().includes(q) || (b.phone && b.phone.includes(buyerSearch))).slice(0, 8);
  }, [buyers, buyerSearch]);

  const handleNotesPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNotesPhotoFile(file);
      setNotesPhotoPreview(URL.createObjectURL(file));
    }
  };

  const resetDrawer = () => {
    setStep(1);
    setIsNewBuyer(false);
    setSelectedBuyerId("");
    setBuyerSearch("");
    setNewBuyer({ name: "", phone: "", email: "", category: "RETAILER" });
    setOrderShopId("");
    setDeliveryDate(undefined);
    setOrderItems([]);
    setOrderNotes("");
    setNotesPhotoFile(null);
    setNotesPhotoPreview(null);
  };

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!appUser) throw new Error("Not authenticated");

      let buyerId = selectedBuyerId;

      if (isNewBuyer) {
        const { data: nb, error: nbErr } = await supabase
          .from("buyers")
          .insert({
            name: newBuyer.name,
            phone: newBuyer.phone || null,
            email: newBuyer.email || null,
            category: newBuyer.category,
          })
          .select()
          .single();
        if (nbErr) throw nbErr;
        buyerId = nb.id;
      }

      // Upload notes photo if exists
      let photoUrl: string | null = null;
      if (notesPhotoFile) {
        const ext = notesPhotoFile.name.split(".").pop();
        const path = `order-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("walkin-proofs").upload(path, notesPhotoFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("walkin-proofs").getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }

      const total = runningTotal;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          buyer_id: buyerId,
          shop_id: orderShopId || null,
          delivery_date: deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : null,
          status: "PENDING" as any,
          payment_status: "PENDING" as any,
          channel: "MANUAL" as any,
          created_by_user_id: appUser.id,
          notes: orderNotes || null,
          notes_photo_url: photoUrl,
          total_amount: total,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      for (const item of orderItems) {
        if (!item.product_id || Number(item.qty) <= 0) continue;
        const reqQty = Number(item.qty);
        const avail = item.available ?? 0;
        const allocQty = Math.min(reqQty, avail);

        await supabase.from("order_items").insert({
          order_id: order.id,
          product_id: item.product_id,
          requested_qty: reqQty,
          allocated_qty: allocQty,
          unit_price: item.unit_price,
          line_total: reqQty * item.unit_price,
        });
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setDrawerOpen(false);
      resetDrawer();
      toast({ title: "Order created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const quickStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: vars.status === "DELIVERED" ? "Order marked as delivered." : "Order marked as picked up." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("order_items").delete().eq("order_id", id);
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setDeleteId(null);
      toast({ title: "Order deleted." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canCreate = appUser?.role === "OWNER" || appUser?.role === "ADMIN" || appUser?.role === "STAFF" || appUser?.role === "SALESMAN";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 pb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 border-gray-300"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="DISPATCHED">Dispatched</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="PICKED_UP">Picked Up</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={shopFilter} onValueChange={setShopFilter}>
          <SelectTrigger className="w-48 border-gray-300"><SelectValue placeholder="All Godowns" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Godowns</SelectItem>
            {godowns.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {canCreate && (
          <Button onClick={() => { resetDrawer(); setDrawerOpen(true); }} className="ml-auto gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Create Order
          </Button>
        )}
      </div>

      {/* Orders table */}
      <div className="rounded-lg border border-gray-200 bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No orders found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Order #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Buyer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Godown</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order: any) => {
                const godownName = order.shop?.type === "GODOWN" ? order.shop?.name : (order.shop?.name || "—");
                return (
                  <tr
                    key={order.id}
                    className="border-b border-gray-200 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-mono font-medium text-foreground">#{order.order_number || order.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{order.buyer?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{order.buyer?.category || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{godownName}</td>
                    <td className="px-4 py-3"><StatusBadge status={statusToBadge[order.status] || "pending"} /></td>
                    <td className="px-4 py-3"><StatusBadge status={paymentToBadge[order.payment_status] || "pending"} /></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {format(new Date(order.created_at), "dd MMM")}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/orders/${order.id}`)}>View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => quickStatus.mutate({ id: order.id, status: "DELIVERED" })}>Mark as Delivered</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => quickStatus.mutate({ id: order.id, status: "PICKED_UP" })}>Mark as Picked Up</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(order.id)}>
                            Delete Order
                          </DropdownMenuItem>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this order? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteOrder.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Order Dialog */}
      <Dialog open={drawerOpen} onOpenChange={(o) => { if (!o) resetDrawer(); setDrawerOpen(o); }}>
        <DialogContent className="w-full sm:max-w-xl max-h-[95vh] overflow-y-auto border border-gray-200">
          <DialogHeader>
            <DialogTitle>Create Order — Step {step}/4</DialogTitle>
          </DialogHeader>
          <div className="mt-6 space-y-6">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-primary" : "bg-muted")} />
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Customer Details</h3>
                <div className="flex items-center gap-2">
                  <Label>New Buyer?</Label>
                  <Switch checked={isNewBuyer} onCheckedChange={setIsNewBuyer} />
                </div>
                {isNewBuyer ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Name *</Label>
                      <Input value={newBuyer.name} onChange={(e) => setNewBuyer((b) => ({ ...b, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Phone</Label>
                      <Input value={newBuyer.phone} onChange={(e) => setNewBuyer((b) => ({ ...b, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input value={newBuyer.email} onChange={(e) => setNewBuyer((b) => ({ ...b, email: e.target.value }))} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>Search Buyer</Label>
                    <Input
                      placeholder="Search by name or phone..."
                      value={buyerSearch}
                      onChange={(e) => { setBuyerSearch(e.target.value); setSelectedBuyerId(""); }}
                    />
                    {buyerSearch && filteredBuyers.length > 0 && !selectedBuyerId && (
                      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-popover">
                        {filteredBuyers.map((b: any) => (
                          <button
                            key={b.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                            onClick={() => { setSelectedBuyerId(b.id); setBuyerSearch(b.name); }}
                          >
                            {b.name} {b.phone && `· ${b.phone}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => setStep(2)}
                  disabled={isNewBuyer ? !newBuyer.name : !selectedBuyerId}
                >
                  Next: Delivery Details
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Delivery Details</h3>
                <div className="space-y-1">
                  <Label>Godown</Label>
                  <Select value={orderShopId} onValueChange={setOrderShopId}>
                    <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                    <SelectContent>
                      {godowns.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Delivery Date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal border-gray-300">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deliveryDate ? format(deliveryDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deliveryDate}
                        onSelect={(d) => setDeliveryDate(d)}
                        disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">Notes & Proof</h4>
                  <div className="space-y-1">
                    <Label>Note</Label>
                    <Input value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Add delivery notes..." />
                  </div>
                  <div className="space-y-1">
                    <Label>Attach Photo (optional)</Label>
                    {notesPhotoPreview ? (
                      <div className="relative inline-block">
                        <img src={notesPhotoPreview} alt="Proof" className="h-24 w-24 rounded-md object-cover border border-gray-200" />
                        <button
                          onClick={() => { setNotesPhotoFile(null); setNotesPhotoPreview(null); }}
                          className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground"
                          type="button"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex h-20 w-32 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 text-muted-foreground hover:border-primary hover:text-primary">
                        <Camera className="h-5 w-5" />
                        <span className="text-xs">Attach</span>
                        <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleNotesPhoto} />
                      </label>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-gray-300">Back</Button>
                  <Button onClick={() => setStep(3)} className="flex-1" disabled={!orderShopId}>Next: Add Items</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Add Items</h3>
                {orderItems.map((item, idx) => {
                  const reqQty = Number(item.qty);
                  const avail = item.available;
                  const matches = item.product_search && !item.product_id
                    ? products.filter((p: any) => p.name.toLowerCase().includes(item.product_search.toLowerCase())).slice(0, 6)
                    : [];
                  return (
                    <div key={idx} className="rounded-md border border-gray-200 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-1 relative">
                          <Input
                            placeholder="Search product..."
                            value={item.product_search}
                            onChange={(e) => updateItemSearch(idx, e.target.value)}
                          />
                          {matches.length > 0 && (
                            <div className="absolute z-10 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-popover shadow-md">
                              {matches.map((p: any) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                                  onClick={() => selectProduct(idx, p)}
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="space-y-1 w-20">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" min="1" value={item.qty} onChange={(e) => updateItemQty(idx, e.target.value)} className="h-8" />
                        </div>
                        <div className="space-y-1 w-28">
                          <Label className="text-xs flex items-center gap-1">
                            Price ₹
                            <button type="button" onClick={() => togglePriceEdit(idx)}>
                              <Pencil className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </button>
                          </Label>
                          <Input
                            type="number"
                            value={item.unit_price}
                            readOnly={!item.price_editable}
                            onChange={(e) => updateItemPrice(idx, Number(e.target.value))}
                            className={cn("h-8", !item.price_editable && "bg-muted")}
                          />
                        </div>
                        <div className="space-y-1 w-24">
                          <Label className="text-xs">Total ₹</Label>
                          <Input value={(reqQty * item.unit_price).toFixed(2)} readOnly className="h-8 bg-muted" />
                        </div>
                        <div className="space-y-1 ml-auto">
                          <Label className="text-xs">Available</Label>
                          {item.product_id && avail !== null ? (
                            <p className={cn("text-sm font-semibold pt-1", avail > 0 ? "text-success" : "text-destructive")}>
                              {avail}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground pt-1">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" onClick={addItemRow} className="w-full gap-2 border-gray-300">
                  <Plus className="h-4 w-4" /> Add Product
                </Button>
                <div className="flex justify-between items-center border-t border-gray-200 pt-3">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="text-lg font-bold text-foreground">₹{runningTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-gray-300">Back</Button>
                  <Button onClick={() => setStep(4)} className="flex-1" disabled={orderItems.length === 0 || orderItems.some((i) => !i.product_id)}>
                    Next: Summary
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                <div className="rounded-md border border-gray-200 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Buyer</span>
                    <span className="font-medium text-foreground">
                      {isNewBuyer ? newBuyer.name : buyers.find((b: any) => b.id === selectedBuyerId)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Godown</span>
                    <span className="font-medium text-foreground">{godowns.find((s: any) => s.id === orderShopId)?.name}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2">
                    {orderItems.map((item, idx) => {
                      const prod = products.find((p: any) => p.id === item.product_id);
                      return (
                        <div key={idx} className="flex justify-between text-sm py-1">
                          <span className="text-muted-foreground">{prod?.name || "—"} × {item.qty} @ ₹{item.unit_price}</span>
                          <span className="font-medium text-foreground">₹{(Number(item.qty) * item.unit_price).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-lg text-foreground">₹{runningTotal.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1 border-gray-300">Back</Button>
                  <Button onClick={() => createOrder.mutate()} className="flex-1" disabled={createOrder.isPending}>
                    {createOrder.isPending ? "Creating..." : "Confirm Order"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
