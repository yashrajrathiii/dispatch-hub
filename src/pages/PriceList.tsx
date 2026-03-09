import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, History } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products"> & { brand: Tables<"brands"> | null };
type PriceList = Tables<"price_lists">;
type ProductPrice = Tables<"product_prices">;

interface PriceRow {
  product: Product;
  dealer: number;
  retailer: number;
}

export default function PriceList() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [editPrices, setEditPrices] = useState<Record<string, { dealer: string; retailer: string }>>({});

  // Fetch active price list
  const { data: activePriceList } = useQuery({
    queryKey: ["active-price-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_lists")
        .select("*")
        .eq("is_active", true)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as PriceList | null;
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["all-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, brand:brands(*)")
        .eq("is_active", true)
        .order("name");
      return (data || []) as Product[];
    },
  });

  // Fetch prices for active list
  const { data: activePrices = [] } = useQuery({
    queryKey: ["product-prices", activePriceList?.id],
    enabled: !!activePriceList?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_prices")
        .select("*")
        .eq("price_list_id", activePriceList!.id);
      return (data || []) as ProductPrice[];
    },
  });

  // Fetch all price lists for history
  const { data: allPriceLists = [] } = useQuery({
    queryKey: ["all-price-lists"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_lists")
        .select("*")
        .order("effective_date", { ascending: false });
      return (data || []) as PriceList[];
    },
  });

  // Build price rows
  const priceRows: PriceRow[] = products.map((p) => {
    const dealer = activePrices.find((pp) => pp.product_id === p.id && pp.buyer_category === "DEALER");
    const retailer = activePrices.find((pp) => pp.product_id === p.id && pp.buyer_category === "RETAILER");
    return {
      product: p,
      dealer: dealer ? Number(dealer.price_per_unit) : 0,
      retailer: retailer ? Number(retailer.price_per_unit) : 0,
    };
  });

  // Group by category
  const categories = ["Dhuli", "Dryfruits", "Oil", "Other"] as const;
  const grouped = categories.map((cat) => ({
    category: cat,
    rows: priceRows.filter((r) => r.product.category === cat),
  })).filter((g) => g.rows.length > 0);

  // Open create modal and pre-fill prices
  const handleOpenCreate = () => {
    const prices: Record<string, { dealer: string; retailer: string; walkin: string }> = {};
    products.forEach((p) => {
      const row = priceRows.find((r) => r.product.id === p.id);
    prices[p.id] = {
        dealer: String(row?.dealer ?? 0),
        retailer: String(row?.retailer ?? 0),
      };
    });
    setEditPrices(prices);
    setNewName(`Price List ${format(new Date(), "dd MMM yyyy")}`);
    setEffectiveDate(new Date());
    setCreateOpen(true);
  };

  const savePriceList = useMutation({
    mutationFn: async () => {
      if (!appUser) return;

      // Deactivate all existing
      await supabase.from("price_lists").update({ is_active: false }).eq("is_active", true);

      // Create new list
      const { data: newList, error: listErr } = await supabase
        .from("price_lists")
        .insert({
          name: newName,
          effective_date: format(effectiveDate, "yyyy-MM-dd"),
          is_active: true,
          created_by_user_id: appUser.id,
        })
        .select()
        .single();
      if (listErr) throw listErr;

      // Insert all prices
      const rows: Array<{
        price_list_id: string;
        product_id: string;
        buyer_category: "DEALER" | "RETAILER" | "WALKIN";
        price_per_unit: number;
      }> = [];
      for (const [productId, vals] of Object.entries(editPrices)) {
        (["DEALER", "RETAILER", "WALKIN"] as const).forEach((cat) => {
          const key = cat.toLowerCase() as "dealer" | "retailer" | "walkin";
          rows.push({
            price_list_id: newList.id,
            product_id: productId,
            buyer_category: cat,
            price_per_unit: Number(vals[key]) || 0,
          });
        });
      }

      const { error: pricesErr } = await supabase.from("product_prices").insert(rows);
      if (pricesErr) throw pricesErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-price-list"] });
      queryClient.invalidateQueries({ queryKey: ["product-prices"] });
      queryClient.invalidateQueries({ queryKey: ["all-price-lists"] });
      setCreateOpen(false);
      toast({ title: "Price list created and activated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const canEdit = appUser?.role === "OWNER" || appUser?.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {activePriceList ? activePriceList.name : "No Active Price List"}
          </h2>
          {activePriceList && (
            <p className="text-sm text-muted-foreground">
              Effective from {format(new Date(activePriceList.effective_date), "dd MMM yyyy")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHistoryOpen(true)} className="gap-2">
            <History className="h-4 w-4" /> History
          </Button>
          {canEdit && (
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Create New Price List
            </Button>
          )}
        </div>
      </div>

      {/* Active price table */}
      {grouped.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          No products found. Add products from Inventory first.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.category} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-muted/50 px-4 py-2">
                <h3 className="text-sm font-semibold text-foreground">{group.category}</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Brand</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Dealer ₹</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Retailer ₹</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Walk-in ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.product.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{row.product.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.product.brand?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{row.dealer > 0 ? `₹${row.dealer}` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{row.retailer > 0 ? `₹${row.retailer}` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{row.walkin > 0 ? `₹${row.walkin}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Create Price List Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Price List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>List Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !effectiveDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {effectiveDate ? format(effectiveDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={effectiveDate}
                      onSelect={(d) => d && setEffectiveDate(d)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Editable prices table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Category</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Dealer ₹</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Retailer ₹</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Walk-in ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-sm font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{p.category}</td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          className="h-8 w-24"
                          value={editPrices[p.id]?.dealer ?? "0"}
                          onChange={(e) => setEditPrices((prev) => ({ ...prev, [p.id]: { ...prev[p.id], dealer: e.target.value } }))}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          className="h-8 w-24"
                          value={editPrices[p.id]?.retailer ?? "0"}
                          onChange={(e) => setEditPrices((prev) => ({ ...prev, [p.id]: { ...prev[p.id], retailer: e.target.value } }))}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          className="h-8 w-24"
                          value={editPrices[p.id]?.walkin ?? "0"}
                          onChange={(e) => setEditPrices((prev) => ({ ...prev, [p.id]: { ...prev[p.id], walkin: e.target.value } }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => savePriceList.mutate()} disabled={!newName || savePriceList.isPending}>
              {savePriceList.isPending ? "Saving..." : "Save & Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Price List History</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {allPriceLists.map((pl) => (
              <div
                key={pl.id}
                className={cn(
                  "flex items-center justify-between rounded-md border px-4 py-3",
                  pl.is_active ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{pl.name}</p>
                  <p className="text-xs text-muted-foreground">Effective: {format(new Date(pl.effective_date), "dd MMM yyyy")}</p>
                </div>
                {pl.is_active && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    Active
                  </span>
                )}
              </div>
            ))}
            {allPriceLists.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">No price lists yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
