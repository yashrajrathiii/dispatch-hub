import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, Pencil, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products"> & { brand: Tables<"brands"> | null };
type PriceList = Tables<"price_lists"> & { creator?: { name: string } | null };
type ProductPrice = Tables<"product_prices">;

interface PriceRow {
  product: Product;
  dealer: number;
  retailer: number;
  walkin: number;
}

export default function PriceList() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [editPrices, setEditPrices] = useState<Record<string, { dealer: string; retailer: string; walkin: string }>>({});
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ dealer: string; retailer: string; walkin: string }>({ dealer: "0", retailer: "0", walkin: "0" });
  const [expandedListId, setExpandedListId] = useState<string | null>(null);

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

  const { data: allPriceLists = [] } = useQuery({
    queryKey: ["all-price-lists"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_lists")
        .select("*, creator:users!price_lists_created_by_user_id_fkey(name)")
        .order("effective_date", { ascending: false });
      return (data || []) as PriceList[];
    },
  });

  // Prices for the currently expanded list
  const { data: expandedPrices = [] } = useQuery({
    queryKey: ["product-prices-expanded", expandedListId],
    enabled: !!expandedListId,
    queryFn: async () => {
      const { data } = await supabase.from("product_prices").select("*").eq("price_list_id", expandedListId!);
      return (data || []) as ProductPrice[];
    },
  });

  const buildRows = (prices: ProductPrice[]): PriceRow[] =>
    products.map((p) => {
      const dealer = prices.find((pp) => pp.product_id === p.id && pp.buyer_category === "DEALER");
      const retailer = prices.find((pp) => pp.product_id === p.id && pp.buyer_category === "RETAILER");
      const walkin = prices.find((pp) => pp.product_id === p.id && pp.buyer_category === "WALKIN");
      return {
        product: p,
        dealer: dealer ? Number(dealer.price_per_unit) : 0,
        retailer: retailer ? Number(retailer.price_per_unit) : 0,
        walkin: walkin ? Number(walkin.price_per_unit) : 0,
      };
    });

  const priceRows = buildRows(activePrices);

  const brands = products.reduce((acc, p) => {
    const brandName = p.brand?.name || "Other";
    if (!acc.includes(brandName)) acc.push(brandName);
    return acc;
  }, [] as string[]);

  const grouped = brands.map((brand) => ({
    brand,
    rows: priceRows.filter((r) => (r.product.brand?.name || "Other") === brand),
  })).filter((g) => g.rows.length > 0);

  const handleOpenCreate = () => {
    const prices: Record<string, { dealer: string; retailer: string; walkin: string }> = {};
    products.forEach((p) => {
      const row = priceRows.find((r) => r.product.id === p.id);
      prices[p.id] = {
        dealer: String(row?.dealer ?? 0),
        retailer: String(row?.retailer ?? 0),
        walkin: String(row?.walkin ?? 0),
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
      await supabase.from("price_lists").update({ is_active: false }).eq("is_active", true);

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

      const rows: Array<{ price_list_id: string; product_id: string; buyer_category: "DEALER" | "RETAILER" | "WALKIN"; price_per_unit: number }> = [];
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

  const startInlineEdit = (row: PriceRow) => {
    setEditingRow(row.product.id);
    setInlineEdit({ dealer: String(row.dealer), retailer: String(row.retailer), walkin: String(row.walkin) });
  };

  const saveInlineEdit = useMutation({
    mutationFn: async (productId: string) => {
      if (!activePriceList) return;
      const cats = ["DEALER", "RETAILER", "WALKIN"] as const;
      for (const cat of cats) {
        const key = cat.toLowerCase() as "dealer" | "retailer" | "walkin";
        const existing = activePrices.find((pp) => pp.product_id === productId && pp.buyer_category === cat);
        if (existing) {
          await supabase.from("product_prices").update({ price_per_unit: Number(inlineEdit[key]) || 0 }).eq("id", existing.id);
        } else {
          await supabase.from("product_prices").insert({
            price_list_id: activePriceList.id,
            product_id: productId,
            buyer_category: cat,
            price_per_unit: Number(inlineEdit[key]) || 0,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-prices"] });
      setEditingRow(null);
      toast({ title: "Price updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">Active Price List</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          {canEdit && tab === "active" && (
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Create New Price List
            </Button>
          )}
        </div>

        <TabsContent value="active" className="mt-6 space-y-6">
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

          {grouped.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
              No products found. Add products from Inventory first.
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.brand} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground">{group.brand}</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Dealer ₹</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Retailer ₹</th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Walk-in ₹</th>
                      {canEdit && <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.product.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{row.product.name}</td>
                        {editingRow === row.product.id ? (
                          <>
                            <td className="px-2 py-1 text-right">
                              <Input type="number" className="h-8 w-24 ml-auto" value={inlineEdit.dealer} onChange={(e) => setInlineEdit(p => ({ ...p, dealer: e.target.value }))} />
                            </td>
                            <td className="px-2 py-1 text-right">
                              <Input type="number" className="h-8 w-24 ml-auto" value={inlineEdit.retailer} onChange={(e) => setInlineEdit(p => ({ ...p, retailer: e.target.value }))} />
                            </td>
                            <td className="px-2 py-1 text-right">
                              <Input type="number" className="h-8 w-24 ml-auto" value={inlineEdit.walkin} onChange={(e) => setInlineEdit(p => ({ ...p, walkin: e.target.value }))} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveInlineEdit.mutate(row.product.id)} disabled={saveInlineEdit.isPending}>
                                  <Check className="h-4 w-4 text-primary" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingRow(null)}>
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{row.dealer > 0 ? `₹${row.dealer}` : "—"}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{row.retailer > 0 ? `₹${row.retailer}` : "—"}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-foreground">{row.walkin > 0 ? `₹${row.walkin}` : "—"}</td>
                            {canEdit && (
                              <td className="px-4 py-3 text-right">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startInlineEdit(row)}>
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-2">
          {allPriceLists.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
              No price list history yet.
            </div>
          ) : allPriceLists.map((pl) => {
            const isExpanded = expandedListId === pl.id;
            const rows = isExpanded ? buildRows(expandedPrices) : [];
            return (
              <div key={pl.id} className={cn("rounded-lg border bg-card shadow-sm", pl.is_active ? "border-primary/40" : "border-border")}>
                <button
                  onClick={() => setExpandedListId(isExpanded ? null : pl.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{pl.name}</span>
                        {pl.is_active && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Active</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Effective {format(new Date(pl.effective_date), "dd MMM yyyy")} · Created by {pl.creator?.name || "—"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{products.length} products</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-left">
                          <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Brand</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground text-right">Dealer ₹</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground text-right">Retailer ₹</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground text-right">Walk-in ₹</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.product.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-2 text-sm text-foreground">{r.product.name}</td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">{r.product.brand?.name || "—"}</td>
                            <td className="px-4 py-2 text-sm text-right">{r.dealer > 0 ? `₹${r.dealer}` : "—"}</td>
                            <td className="px-4 py-2 text-sm text-right">{r.retailer > 0 ? `₹${r.retailer}` : "—"}</td>
                            <td className="px-4 py-2 text-sm text-right">{r.walkin > 0 ? `₹${r.walkin}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

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
                    <Calendar mode="single" selected={effectiveDate} onSelect={(d) => d && setEffectiveDate(d)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Brand</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Dealer ₹</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Retailer ₹</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Walk-in ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-sm font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{p.brand?.name || "—"}</td>
                      <td className="px-2 py-1">
                        <Input type="number" className="h-8 w-24" value={editPrices[p.id]?.dealer ?? "0"} onChange={(e) => setEditPrices(prev => ({ ...prev, [p.id]: { ...prev[p.id], dealer: e.target.value } }))} />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" className="h-8 w-24" value={editPrices[p.id]?.retailer ?? "0"} onChange={(e) => setEditPrices(prev => ({ ...prev, [p.id]: { ...prev[p.id], retailer: e.target.value } }))} />
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number" className="h-8 w-24" value={editPrices[p.id]?.walkin ?? "0"} onChange={(e) => setEditPrices(prev => ({ ...prev, [p.id]: { ...prev[p.id], walkin: e.target.value } }))} />
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
    </div>
  );
}
