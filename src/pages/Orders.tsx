import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, Eye, X, Check, AlertTriangle, Trash2 } from "lucide-react";

type OrderStatus = "PENDING" | "CONFIRMED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
type PaymentStatus = "PENDING" | "PARTIAL" | "PAID";

const statusToBadge: Record<string, any> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  DISPATCHED: "dispatched",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
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

  // Create order state
  const [isNewBuyer, setIsNewBuyer] = useState(false);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [newBuyer, setNewBuyer] = useState({ name: "", phone: "", email: "", category: "RETAILER" as "DEALER" | "RETAILER" | "WALKIN" });
  const [orderShopId, setOrderShopId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date>(new Date());
  const [deliverySlot, setDeliverySlot] = useState<string>("MORNING");
  const [orderItems, setOrderItems] = useState<Array<{ product_id: string; qty: string; unit_price: number; available: number | null }>>([]);
  const [orderNotes, setOrderNotes] = useState("");

  // Data queries
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, buyer:buyers(*), shop:shops(*), created_by:users!orders_created_by_user_id_fkey(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["shops-active"],
    queryFn: async () => {
      const { data } = await supabase.from("shops").select("*").eq("is_active", true);
      return data || [];
    },
  });

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
    setOrderItems([...orderItems, { product_id: "", qty: "1", unit_price: 0, available: null }]);
  };

  const updateItemProduct = (idx: number, productId: string) => {
    const price = getPrice(productId);
    const avail = getAvailable(productId);
    setOrderItems((items) =>
      items.map((item, i) => (i === idx ? { ...item, product_id: productId, unit_price: price, available: avail } : item))
    );
  };

  const updateItemQty = (idx: number, qty: string) => {
    setOrderItems((items) => items.map((item, i) => (i === idx ? { ...item, qty } : item)));
  };

  const removeItem = (idx: number) => {
    setOrderItems((items) => items.filter((_, i) => i !== idx));
  };

  const runningTotal = orderItems.reduce((sum, item) => sum + Number(item.qty) * item.unit_price, 0);

  const resetDrawer = () => {
    setStep(1);
    setIsNewBuyer(false);
    setSelectedBuyerId("");
    setNewBuyer({ name: "", phone: "", email: "", category: "RETAILER" });
    setOrderShopId("");
    setDeliveryDate(new Date());
    setDeliverySlot("MORNING");
    setOrderItems([]);
    setOrderNotes("");
  };

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!appUser) throw new Error("Not authenticated");

      let buyerId = selectedBuyerId;

      // Create new buyer if needed
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

      // Create order
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          buyer_id: buyerId,
          shop_id: orderShopId || null,
          delivery_date: format(deliveryDate, "yyyy-MM-dd"),
          delivery_slot: deliverySlot as any,
          status: "PENDING" as any,
          payment_status: "PENDING" as any,
          channel: "MANUAL" as any,
          created_by_user_id: appUser.id,
          notes: orderNotes || null,
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      // Create order items & update inventory
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

        // Deduct from inventory
        if (allocQty > 0 && orderShopId) {
          const inv = inventoryData.find((i: any) => i.product_id === item.product_id);
          if (inv) {
            await supabase
              .from("inventory")
              .update({ quantity: Number(inv.quantity) - allocQty, last_updated_at: new Date().toISOString(), updated_by_user_id: appUser.id })
              .eq("id", inv.id);

            await supabase.from("inventory_logs").insert({
              shop_id: orderShopId,
              product_id: item.product_id,
              change_type: "SOLD" as any,
              quantity_change: -allocQty,
              note: `Order ${order.id.slice(0, 8)}`,
              created_by_user_id: appUser.id,
            });
          }
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setDrawerOpen(false);
      resetDrawer();
      toast({ title: "Order created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canCreate = appUser?.role === "OWNER" || appUser?.role === "ADMIN" || appUser?.role === "STAFF";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
            <SelectItem value="DISPATCHED">Dispatched</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={shopFilter} onValueChange={setShopFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Shops" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shops</SelectItem>
            {shops.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {canCreate && (
          <Button onClick={() => { resetDrawer(); setDrawerOpen(true); }} className="ml-auto gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Create Order
          </Button>
        )}
      </div>

      {/* Orders table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No orders found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Order #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Buyer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Shop</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Delivery</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Slot</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order: any) => (
                <tr key={order.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-foreground">#{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{order.buyer?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{order.buyer?.category || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{order.shop?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {order.delivery_date ? format(new Date(order.delivery_date), "dd MMM") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{order.delivery_slot || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={statusToBadge[order.status] || "pending"} /></td>
                  <td className="px-4 py-3"><StatusBadge status={paymentToBadge[order.payment_status] || "pending"} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {format(new Date(order.created_at), "dd MMM")}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/orders/${order.id}`)} className="gap-1">
                      <Eye className="h-4 w-4" /> View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Order Drawer */}
      <Sheet open={drawerOpen} onOpenChange={(o) => { if (!o) resetDrawer(); setDrawerOpen(o); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Order — Step {step}/4</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* Step indicator */}
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-primary" : "bg-muted")} />
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Step 1: Select Buyer</h3>
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
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select value={newBuyer.category} onValueChange={(v: any) => setNewBuyer((b) => ({ ...b, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DEALER">Dealer</SelectItem>
                          <SelectItem value="RETAILER">Retailer</SelectItem>
                          <SelectItem value="WALKIN">Walk-in</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label>Select Buyer</Label>
                    <Select value={selectedBuyerId} onValueChange={setSelectedBuyerId}>
                      <SelectTrigger><SelectValue placeholder="Search buyer..." /></SelectTrigger>
                      <SelectContent>
                        {buyers.map((b: any) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} ({b.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedBuyerId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Category: {buyers.find((b: any) => b.id === selectedBuyerId)?.category}
                      </p>
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
                <h3 className="text-sm font-semibold text-foreground">Step 2: Delivery Details</h3>
                <div className="space-y-1">
                  <Label>Shop</Label>
                  <Select value={orderShopId} onValueChange={setOrderShopId}>
                    <SelectTrigger><SelectValue placeholder="Select shop" /></SelectTrigger>
                    <SelectContent>
                      {shops.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Delivery Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(deliveryDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deliveryDate}
                        onSelect={(d) => d && setDeliveryDate(d)}
                        disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label>Slot</Label>
                  <Select value={deliverySlot} onValueChange={setDeliverySlot}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MORNING">Morning</SelectItem>
                      <SelectItem value="AFTERNOON">Afternoon</SelectItem>
                      <SelectItem value="EVENING">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Optional notes..." />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button onClick={() => setStep(3)} className="flex-1" disabled={!orderShopId}>Next: Products</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Step 3: Add Products</h3>
                {orderItems.map((item, idx) => {
                  const reqQty = Number(item.qty);
                  const avail = item.available;
                  const isLow = avail !== null && avail < reqQty;
                  const isSufficient = avail !== null && avail >= reqQty;
                  return (
                    <div key={idx} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select value={item.product_id} onValueChange={(v) => updateItemProduct(idx, v)}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="space-y-1 w-24">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" min="1" value={item.qty} onChange={(e) => updateItemQty(idx, e.target.value)} className="h-8" />
                        </div>
                        <div className="space-y-1 w-24">
                          <Label className="text-xs">Price ₹</Label>
                          <Input value={item.unit_price} readOnly className="h-8 bg-muted" />
                        </div>
                        <div className="space-y-1 w-24">
                          <Label className="text-xs">Total ₹</Label>
                          <Input value={(reqQty * item.unit_price).toFixed(2)} readOnly className="h-8 bg-muted" />
                        </div>
                        <div className="flex items-center pt-5">
                          {item.product_id && avail !== null && (
                            isSufficient ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4 text-warning" />
                                <span className="text-xs text-warning">Only {avail}</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" onClick={addItemRow} className="w-full gap-2">
                  <Plus className="h-4 w-4" /> Add Product
                </Button>
                <div className="flex justify-between items-center border-t border-border pt-3">
                  <span className="text-sm font-medium text-muted-foreground">Running Total</span>
                  <span className="text-lg font-bold text-foreground">₹{runningTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                  <Button onClick={() => setStep(4)} className="flex-1" disabled={orderItems.length === 0 || orderItems.some((i) => !i.product_id)}>
                    Next: Confirm
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Step 4: Order Summary</h3>
                <div className="rounded-md border border-border p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Buyer</span>
                    <span className="font-medium text-foreground">
                      {isNewBuyer ? newBuyer.name : buyers.find((b: any) => b.id === selectedBuyerId)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shop</span>
                    <span className="font-medium text-foreground">{shops.find((s: any) => s.id === orderShopId)?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="font-medium text-foreground">{format(deliveryDate, "dd MMM yyyy")} · {deliverySlot}</span>
                  </div>
                  <div className="border-t border-border pt-2">
                    {orderItems.map((item, idx) => {
                      const prod = products.find((p: any) => p.id === item.product_id);
                      return (
                        <div key={idx} className="flex justify-between text-sm py-1">
                          <span className="text-muted-foreground">{prod?.name || "—"} × {item.qty}</span>
                          <span className="font-medium text-foreground">₹{(Number(item.qty) * item.unit_price).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-lg text-foreground">₹{runningTotal.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
                  <Button onClick={() => createOrder.mutate()} className="flex-1" disabled={createOrder.isPending}>
                    {createOrder.isPending ? "Creating..." : "Place Order"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
