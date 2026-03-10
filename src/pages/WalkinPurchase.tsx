import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ShoppingBag, Plus, Trash2, Camera, X } from "lucide-react";

interface ItemRow {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export default function WalkinPurchase() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [existingBuyer, setExistingBuyer] = useState(true);
  const [buyerId, setBuyerId] = useState("");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [newBuyer, setNewBuyer] = useState({ name: "", phone: "", category: "WALKIN" as string });
  const [items, setItems] = useState<ItemRow[]>([{ product_id: "", quantity: "", unit_price: "" }]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const { data: buyers = [] } = useQuery({
    queryKey: ["buyers"],
    queryFn: async () => {
      const { data } = await supabase.from("buyers").select("*").eq("is_active", true);
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, brand:brands(name)").eq("is_active", true);
      return data || [];
    },
  });

  const { data: activePriceList } = useQuery({
    queryKey: ["active-price-list-prices"],
    queryFn: async () => {
      const { data: pl } = await supabase.from("price_lists").select("id").eq("is_active", true).order("effective_date", { ascending: false }).limit(1).maybeSingle();
      if (!pl) return null;
      const { data: prices } = await supabase.from("product_prices").select("*").eq("price_list_id", pl.id);
      return { id: pl.id, prices: prices || [] };
    },
  });

  const filteredBuyers = buyers.filter((b: any) =>
    b.name.toLowerCase().includes(buyerSearch.toLowerCase()) ||
    (b.phone && b.phone.includes(buyerSearch))
  );

  const selectedBuyer = buyers.find((b: any) => b.id === buyerId);

  const getBuyerCategory = (): string => {
    if (existingBuyer && selectedBuyer) return selectedBuyer.category;
    return newBuyer.category;
  };

  const getAutoPrice = (productId: string): string => {
    if (!activePriceList) return "";
    const cat = getBuyerCategory();
    const price = activePriceList.prices.find(
      (p: any) => p.product_id === productId && p.buyer_category === cat
    );
    return price ? String(price.price_per_unit) : "";
  };

  const addItemRow = () => setItems([...items, { product_id: "", quantity: "", unit_price: "" }]);

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ItemRow, value: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "product_id" && value) {
      const autoPrice = getAutoPrice(value);
      if (autoPrice) updated[idx].unit_price = autoPrice;
    }
    setItems(updated);
  };

  const runningTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  }, [items]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const resetForm = () => {
    setExistingBuyer(true);
    setBuyerId("");
    setBuyerSearch("");
    setNewBuyer({ name: "", phone: "", category: "WALKIN" });
    setItems([{ product_id: "", quantity: "", unit_price: "" }]);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const submitPurchase = useMutation({
    mutationFn: async () => {
      if (!appUser) throw new Error("Not authenticated");

      const shopId = appUser.assigned_shop_id;
      if (!shopId) throw new Error("You are not assigned to a shop");

      // 1. Resolve buyer
      let finalBuyerId: string | null = null;
      if (existingBuyer && buyerId) {
        finalBuyerId = buyerId;
      } else if (!existingBuyer && newBuyer.name && newBuyer.phone) {
        // Check if buyer exists by phone
        const { data: existingB } = await supabase.from("buyers").select("id").eq("phone", newBuyer.phone).maybeSingle();
        if (existingB) {
          finalBuyerId = existingB.id;
        } else {
          const { data: createdBuyer, error: buyerErr } = await supabase.from("buyers").insert({
            name: newBuyer.name,
            phone: newBuyer.phone,
            category: newBuyer.category as any,
          }).select("id").single();
          if (buyerErr) throw buyerErr;
          finalBuyerId = createdBuyer.id;
        }
      }

      // 2. Upload photo if exists
      let photoUrl: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("walkin-proofs").upload(path, photoFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("walkin-proofs").getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      // 3. Create walkin_purchase
      const validItems = items.filter(i => i.product_id && Number(i.quantity) > 0 && Number(i.unit_price) >= 0);
      const total = validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);

      const { data: purchase, error: purchaseErr } = await supabase.from("walkin_purchases").insert({
        buyer_id: finalBuyerId,
        buyer_name_override: !existingBuyer ? newBuyer.name : null,
        buyer_phone_override: !existingBuyer ? newBuyer.phone : null,
        shop_id: shopId,
        created_by_user_id: appUser.id,
        total_amount: total,
        bill_status: "PENDING" as any,
        photo_proof_url: photoUrl,
      }).select("id").single();
      if (purchaseErr) throw purchaseErr;

      // 4. Create walkin_items
      const walkinItems = validItems.map(i => ({
        walkin_purchase_id: purchase.id,
        product_id: i.product_id,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        line_total: Number(i.quantity) * Number(i.unit_price),
      }));
      const { error: itemsErr } = await supabase.from("walkin_items").insert(walkinItems);
      if (itemsErr) throw itemsErr;

      // 5. Deduct stock from inventory and log
      for (const item of validItems) {
        const { data: inv } = await supabase.from("inventory")
          .select("id, quantity")
          .eq("shop_id", shopId)
          .eq("product_id", item.product_id)
          .maybeSingle();

        if (inv) {
          await supabase.from("inventory").update({
            quantity: Number(inv.quantity) - Number(item.quantity),
            last_updated_at: new Date().toISOString(),
            updated_by_user_id: appUser.id,
          }).eq("id", inv.id);
        }

        await supabase.from("inventory_logs").insert({
          shop_id: shopId,
          product_id: item.product_id,
          change_type: "SOLD" as any,
          quantity_change: -Number(item.quantity),
          note: `Walk-in sale #${purchase.id.slice(0, 8)}`,
          created_by_user_id: appUser.id,
        });
      }

      // 6. Get shop name for notification
      const { data: shop } = await supabase.from("shops").select("name").eq("id", shopId).maybeSingle();

      // 7. Notify all accountants
      const { data: accountants } = await supabase.from("users").select("id").eq("role", "ACCOUNTANT").eq("is_active", true);
      if (accountants && accountants.length > 0) {
        const notifications = accountants.map((acc: any) => ({
          recipient_user_id: acc.id,
          type: "BILLING" as any,
          title: "New Walk-in Purchase – Bill Required",
          message: `A walk-in purchase of ₹${total.toLocaleString("en-IN")} was recorded at ${shop?.name || "Unknown Shop"} by ${appUser.name}. Please generate the bill.`,
          reference_id: purchase.id,
          reference_type: "WALKIN",
        }));
        await supabase.from("notifications").insert(notifications);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["walkin-purchases"] });
      setModalOpen(false);
      resetForm();
      toast({ title: "Purchase recorded. Accountant has been notified." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canSubmit = (existingBuyer ? !!buyerId : (!!newBuyer.name && !!newBuyer.phone)) &&
    items.some(i => i.product_id && Number(i.quantity) > 0 && Number(i.unit_price) >= 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Record walk-in purchases and notify the accountant for billing.</p>
        </div>
        <Button size="lg" className="gap-2 bg-success text-success-foreground hover:bg-success/90" onClick={() => setModalOpen(true)}>
          <ShoppingBag className="h-5 w-5" /> Record Walk-in Purchase
        </Button>
      </div>

      {/* Recent purchases list */}
      <RecentPurchases />

      {/* Record Purchase Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Walk-in Purchase</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Section 1 – Buyer Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Buyer Info</h3>
              <div className="flex items-center gap-3">
                <Label className="text-sm">Existing Buyer</Label>
                <Switch checked={existingBuyer} onCheckedChange={setExistingBuyer} />
              </div>

              {existingBuyer ? (
                <div className="space-y-2">
                  <Label>Search Buyer</Label>
                  <Input placeholder="Search by name or phone..." value={buyerSearch} onChange={(e) => setBuyerSearch(e.target.value)} />
                  {buyerSearch && (
                    <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-popover">
                      {filteredBuyers.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">No buyers found</p>
                      ) : (
                        filteredBuyers.slice(0, 10).map((b: any) => (
                          <button
                            key={b.id}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${buyerId === b.id ? "bg-accent font-medium" : ""}`}
                            onClick={() => { setBuyerId(b.id); setBuyerSearch(b.name); }}
                          >
                            {b.name} {b.phone && `(${b.phone})`} — <span className="text-muted-foreground capitalize">{b.category.toLowerCase()}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {selectedBuyer && (
                    <p className="text-xs text-muted-foreground">Selected: {selectedBuyer.name} ({selectedBuyer.category})</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Name *</Label>
                    <Input value={newBuyer.name} onChange={(e) => setNewBuyer(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone *</Label>
                    <Input value={newBuyer.phone} onChange={(e) => setNewBuyer(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={newBuyer.category} onValueChange={(v) => setNewBuyer(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEALER">Dealer</SelectItem>
                        <SelectItem value="RETAILER">Retailer</SelectItem>
                        <SelectItem value="WALKIN">Walk-in</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2 – Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Items Purchased</h3>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-2 items-end">
                    <div className="space-y-1">
                      {idx === 0 && <Label className="text-xs">Product</Label>}
                      <Select value={item.product_id} onValueChange={(v) => updateItem(idx, "product_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      {idx === 0 && <Label className="text-xs">Qty</Label>}
                      <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      {idx === 0 && <Label className="text-xs">Unit ₹</Label>}
                      <Input type="number" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} placeholder="0" />
                    </div>
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeItemRow(idx)} disabled={items.length <= 1}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={addItemRow}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
              <div className="text-right">
                <span className="text-lg font-bold text-success">Total: ₹{runningTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Section 3 – Photo Proof */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Photo Proof (Optional)</h3>
              {photoPreview ? (
                <div className="relative inline-block">
                  <img src={photoPreview} alt="Proof" className="h-24 w-24 rounded-md object-cover border border-border" />
                  <button onClick={removePhoto} className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 w-40 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <Camera className="h-5 w-5" />
                  <span className="text-sm">Attach Photo</span>
                  <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoChange} />
                </label>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={() => submitPurchase.mutate()}
              disabled={!canSubmit || submitPurchase.isPending}
            >
              {submitPurchase.isPending ? "Recording..." : "Record Purchase & Notify Accountant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecentPurchases() {
  const { data: recent = [], isLoading } = useQuery({
    queryKey: ["walkin-purchases-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("walkin_purchases")
        .select("*, shop:shops(name), buyer:buyers(name, phone)")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const billStatusStyle: Record<string, string> = {
    PENDING: "bg-warning/10 text-warning",
    BILLED: "bg-success/10 text-success",
    SENT: "bg-primary/10 text-primary",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (recent.length === 0) {
    return <div className="py-12 text-center text-muted-foreground">No walk-in purchases recorded yet.</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Date</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Shop</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Buyer</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Total</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Bill Status</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((p: any) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{p.shop?.name || "—"}</td>
              <td className="px-4 py-3 text-sm text-foreground">{p.buyer?.name || p.buyer_name_override || "Unknown"}</td>
              <td className="px-4 py-3 text-sm font-medium text-foreground">₹{Number(p.total_amount).toLocaleString("en-IN")}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${billStatusStyle[p.bill_status] || ""}`}>
                  {p.bill_status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
