import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function Billing() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["billing-purchases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("walkin_purchases")
        .select("*, shop:shops(name), buyer:buyers(name, phone), created_by:users!walkin_purchases_created_by_user_id_fkey(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = purchases.filter((p: any) => {
    if (statusFilter !== "all" && p.bill_status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const buyerName = (p.buyer?.name || p.buyer_name_override || "").toLowerCase();
      if (!buyerName.includes(s)) return false;
    }
    return true;
  });

  const billStatusStyle: Record<string, string> = {
    PENDING: "bg-warning/10 text-warning",
    BILLED: "bg-success/10 text-success",
    SENT: "bg-primary/10 text-primary",
  };

  const stats = {
    pending: purchases.filter((p: any) => p.bill_status === "PENDING").length,
    billed: purchases.filter((p: any) => p.bill_status === "BILLED").length,
    sent: purchases.filter((p: any) => p.bill_status === "SENT").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-5 shadow-sm">
          <p className="text-sm font-medium text-warning">Pending Bills</p>
          <p className="mt-2 text-3xl font-bold text-warning">{stats.pending}</p>
        </div>
        <div className="rounded-lg border border-success/30 bg-success/5 p-5 shadow-sm">
          <p className="text-sm font-medium text-success">Billed</p>
          <p className="mt-2 text-3xl font-bold text-success">{stats.billed}</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 shadow-sm">
          <p className="text-sm font-medium text-primary">Sent</p>
          <p className="mt-2 text-3xl font-bold text-primary">{stats.sent}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="BILLED">Billed</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search buyer..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No billing records found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Shop</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Buyer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Photo</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Bill Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/billing/${p.id}`)}
                >
                  <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p.shop?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-foreground font-medium">{p.buyer?.name || p.buyer_name_override || "Unknown"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">₹{Number(p.total_amount).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    {p.photo_proof_url ? (
                      <img src={p.photo_proof_url} alt="Proof" className="h-8 w-8 rounded object-cover border border-border" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${billStatusStyle[p.bill_status] || ""}`}>
                      {p.bill_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
