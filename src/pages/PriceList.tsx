import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
import { CalendarIcon, Plus, Pencil, Check, X, ChevronDown, ChevronRight, Search, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products"> & { brand: Tables<"brands"> | null };
type PriceList = Tables<"price_lists"> & { creator?: { name: string } | null };
type ProductPrice = Tables<"product_prices">;

interface PriceRow {
  product: Product;
  price: number;
}

export default function PriceList() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState<Date>(new Date());
  const [editPrices, setEditPrices] = useState<Record<string, string>>({});
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<string>("0");
  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState("");

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
      const priceEntry = prices.find((pp) => pp.product_id === p.id);
      return {
        product: p,
        price: priceEntry ? Number(priceEntry.price_per_unit) : 0,
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

  const filteredGrouped = grouped.map((group) => {
    const brandMatches = group.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchedRows = group.rows.filter((row) => 
      brandMatches || row.product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return {
      ...group,
      rows: matchedRows
    };
  }).filter((group) => group.rows.length > 0);

  const handleOpenCreate = () => {
    const prices: Record<string, string> = {};
    products.forEach((p) => {
      const row = priceRows.find((r) => r.product.id === p.id);
      prices[p.id] = String(row?.price ?? 0);
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

      const existingNote = activePriceList?.name.split("||")[1] || "";
      const fullName = existingNote ? `${newName}||${existingNote}` : newName;

      const { data: newList, error: listErr } = await supabase
        .from("price_lists")
        .insert({
          name: fullName,
          effective_date: format(effectiveDate, "yyyy-MM-dd"),
          is_active: true,
          created_by_user_id: appUser.id,
        })
        .select()
        .single();
      if (listErr) throw listErr;

      const rows: Array<{ price_list_id: string; product_id: string; buyer_category: "DEALER" | "RETAILER" | "WALKIN"; price_per_unit: number }> = [];
      for (const [productId, val] of Object.entries(editPrices)) {
        (["DEALER", "RETAILER", "WALKIN"] as const).forEach((cat) => {
          rows.push({
            price_list_id: newList.id,
            product_id: productId,
            buyer_category: cat,
            price_per_unit: Number(val) || 0,
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
    setInlineEdit(String(row.price));
  };

  const saveInlineEdit = useMutation({
    mutationFn: async (productId: string) => {
      if (!activePriceList) return;
      const cats = ["DEALER", "RETAILER", "WALKIN"] as const;
      for (const cat of cats) {
        const existing = activePrices.find((pp) => pp.product_id === productId && pp.buyer_category === cat);
        if (existing) {
          await supabase.from("product_prices").update({ price_per_unit: Number(inlineEdit) || 0 }).eq("id", existing.id);
        } else {
          await supabase.from("product_prices").insert({
            price_list_id: activePriceList.id,
            product_id: productId,
            buyer_category: cat,
            price_per_unit: Number(inlineEdit) || 0,
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

  const updateNoteMutation = useMutation({
    mutationFn: async (newNote: string) => {
      if (!activePriceList) return;
      const parts = activePriceList.name.split("||");
      const actualName = parts[0];
      const updatedName = `${actualName}||${newNote}`;
      
      const { error } = await supabase
        .from("price_lists")
        .update({ name: updatedName })
        .eq("id", activePriceList.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-price-list"] });
      queryClient.invalidateQueries({ queryKey: ["all-price-lists"] });
      setIsEditingNote(false);
      toast({ title: "Salesmen note updated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error updating note", description: err.message, variant: "destructive" });
    }
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
              {activePriceList ? activePriceList.name.split("||")[0] : "No Active Price List"}
            </h2>
            {activePriceList && (
              <p className="text-sm text-muted-foreground">
                Effective from {format(new Date(activePriceList.effective_date), "dd MMM yyyy")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Left Column: Salesmen Note Box */}
            <div className="md:col-span-2 rounded-lg border border-warning/30 bg-warning/5 dark:bg-warning/10 p-4 relative shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 w-full">
                  <FileText className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                  <div className="w-full">
                     <h4 className="text-sm font-semibold text-warning-foreground uppercase tracking-wide">Notice for Salesmen</h4>
                    {!activePriceList ? (
                      <p className="text-sm mt-1 text-muted-foreground italic">
                        No active price list. Create a price list to write a notice.
                      </p>
                    ) : isEditingNote ? (
                      <div className="mt-2 space-y-2 w-full">
                        <textarea
                          className="w-full min-h-[80px] p-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-warning"
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder="Type a customizable note for the salesmen here..."
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsEditingNote(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-warning text-warning-foreground hover:bg-warning/90"
                            onClick={() => updateNoteMutation.mutate(noteInput)}
                            disabled={updateNoteMutation.isPending}
                          >
                            {updateNoteMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm mt-1 text-muted-foreground whitespace-pre-wrap">
                        {activePriceList.name.split("||")[1] || "No customizable note added yet. Click edit to add a note for salesmen."}
                      </p>
                    )}
                  </div>
                </div>
                
                {activePriceList && canEdit && !isEditingNote && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-warning/20 text-warning flex-shrink-0"
                    onClick={() => {
                      setNoteInput(activePriceList.name.split("||")[1] || "");
                      setIsEditingNote(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Right Column: Search Bar */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-10 w-full"
                  placeholder="Search brand or product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {filteredGrouped.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
              {searchQuery ? "No products match your search." : "No products found. Add products from Inventory first."}
            </div>
          ) : (
            filteredGrouped.map((group) => (
              <div key={group.brand} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground">{group.brand}</h3>
                </div>
                <table className="w-full" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                      <th style={{ width: "150px" }} className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Price ₹</th>
                      {canEdit && <th style={{ width: "100px" }} className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.product.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{row.product.name}</td>
                        {editingRow === row.product.id ? (
                          <>
                            <td style={{ width: "150px" }} className="px-4 py-3 text-right">
                              <Input type="number" className="h-8 w-24 ml-auto" value={inlineEdit} onChange={(e) => setInlineEdit(e.target.value)} />
                            </td>
                            <td style={{ width: "100px" }} className="px-4 py-3 text-right">
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
                            <td style={{ width: "150px" }} className="px-4 py-3 text-sm text-right font-medium text-foreground">{row.price > 0 ? `₹${row.price}` : "—"}</td>
                            {canEdit && (
                              <td style={{ width: "100px" }} className="px-4 py-3 text-right">
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
                        <span className="text-sm font-semibold text-foreground">{pl.name.split("||")[0]}</span>
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
                          <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground text-right">Price ₹</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.product.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-2 text-sm text-foreground">{r.product.name}</td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">{r.product.brand?.name || "—"}</td>
                            <td className="px-4 py-2 text-sm text-right">{r.price > 0 ? `₹${r.price}` : "—"}</td>
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
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground text-right">Price ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-sm font-medium text-foreground">{p.name}</td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{p.brand?.name || "—"}</td>
                      <td className="px-2 py-1">
                        <Input type="number" className="h-8 w-24 ml-auto" value={editPrices[p.id] ?? "0"} onChange={(e) => setEditPrices(prev => ({ ...prev, [p.id]: e.target.value }))} />
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
