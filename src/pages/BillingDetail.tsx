import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Printer, Send, ExternalLink } from "lucide-react";
import { useState, useRef } from "react";

export default function BillingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [billPreview, setBillPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: purchase, isLoading } = useQuery({
    queryKey: ["billing-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("walkin_purchases")
        .select("*, shop:shops(name), buyer:buyers(name, phone, category), created_by:users!walkin_purchases_created_by_user_id_fkey(name)")
        .eq("id", id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["billing-items", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("walkin_items")
        .select("*, product:products(name, sku, unit)")
        .eq("walkin_purchase_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("walkin_purchases").update({ bill_status: status as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["billing-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["billing-purchases"] });
      toast({ title: status === "BILLED" ? "Bill generated" : "Bill marked as sent" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handlePrint = () => {
    setBillPreview(true);
    setTimeout(() => {
      const content = printRef.current;
      if (!content) return;
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(`
        <html><head><title>Bill</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f5f5f5; font-size: 12px; text-transform: uppercase; }
          .header { text-align: center; margin-bottom: 30px; }
          .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 20px; }
          .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .info div { font-size: 14px; }
        </style></head><body>
        ${content.innerHTML}
        </body></html>
      `);
      win.document.close();
      win.print();
    }, 200);
  };

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

  if (!purchase) {
    return <div className="py-12 text-center text-muted-foreground">Purchase not found.</div>;
  }

  const buyerName = purchase.buyer?.name || purchase.buyer_name_override || "Unknown";
  const buyerPhone = purchase.buyer?.phone || purchase.buyer_phone_override || "—";
  const buyerCategory = purchase.buyer?.category || "WALKIN";

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/billing")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Billing
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{buyerName}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {buyerPhone} · <span className="capitalize">{buyerCategory.toLowerCase()}</span> · {purchase.shop?.name || "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Recorded on {new Date(purchase.created_at).toLocaleString()} by {(purchase.created_by as any)?.name || "—"}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${billStatusStyle[purchase.bill_status] || ""}`}>
          {purchase.bill_status}
        </span>
      </div>

      {/* Items Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">SKU</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Qty</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Unit Price</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{item.product?.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.product?.sku}</td>
                <td className="px-4 py-3 text-sm text-foreground">{Number(item.quantity)}</td>
                <td className="px-4 py-3 text-sm text-foreground">₹{Number(item.unit_price).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">₹{Number(item.line_total).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="text-right">
        <span className="text-2xl font-bold text-success">Grand Total: ₹{Number(purchase.total_amount).toLocaleString("en-IN")}</span>
      </div>

      {/* Photo Proof */}
      {purchase.photo_proof_url && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Photo Proof</h3>
          <div className="flex items-center gap-3">
            <img src={purchase.photo_proof_url} alt="Proof" className="h-32 w-32 rounded-lg object-cover border border-border" />
            <a href={purchase.photo_proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
              <ExternalLink className="h-4 w-4" /> View Full
            </a>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {purchase.bill_status === "PENDING" && (
          <Button className="gap-2" onClick={() => { handlePrint(); updateStatus.mutate("BILLED"); }}>
            <Printer className="h-4 w-4" /> Generate Bill
          </Button>
        )}
        {purchase.bill_status === "BILLED" && (
          <>
            <Button variant="outline" className="gap-2" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Reprint Bill
            </Button>
            <Button className="gap-2" onClick={() => updateStatus.mutate("SENT")}>
              <Send className="h-4 w-4" /> Mark as Sent
            </Button>
          </>
        )}
        {purchase.bill_status === "SENT" && (
          <Button variant="outline" className="gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Reprint Bill
          </Button>
        )}
      </div>

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="header">
            <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>DispatchOps</h1>
            <p style={{ fontSize: "12px", color: "#666" }}>Invoice / Bill</p>
          </div>
          <div className="info" style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <p><strong>Buyer:</strong> {buyerName}</p>
              <p><strong>Phone:</strong> {buyerPhone}</p>
              <p><strong>Category:</strong> {buyerCategory}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p><strong>Date:</strong> {new Date(purchase.created_at).toLocaleDateString()}</p>
              <p><strong>Bill #:</strong> {purchase.id.slice(0, 8).toUpperCase()}</p>
              <p><strong>Shop:</strong> {purchase.shop?.name || "—"}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id}>
                  <td>{item.product?.name}</td>
                  <td>{Number(item.quantity)}</td>
                  <td>₹{Number(item.unit_price).toLocaleString("en-IN")}</td>
                  <td>₹{Number(item.line_total).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="total">
            Grand Total: ₹{Number(purchase.total_amount).toLocaleString("en-IN")}
          </div>
        </div>
      </div>
    </div>
  );
}
