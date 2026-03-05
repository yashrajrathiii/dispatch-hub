import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowLeft, Check, Truck, Package, MapPin } from "lucide-react";

const STEPS = [
  { key: "PENDING", label: "Pending", icon: Package },
  { key: "CONFIRMED", label: "Confirmed", icon: Check },
  { key: "DISPATCHED", label: "Dispatched", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: MapPin },
] as const;

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

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, buyer:buyers(*), shop:shops(*), created_by:users!orders_created_by_user_id_fkey(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["order-items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("*, product:products(*, brand:brands(*))")
        .eq("order_id", id!);
      return data || [];
    },
  });

  const { data: dispatch } = useQuery({
    queryKey: ["order-dispatch", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("dispatches")
        .select("*, driver:users!dispatches_driver_user_id_fkey(*)")
        .eq("order_id", id!)
        .maybeSingle();
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("orders").update({ status: newStatus as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePayment = useMutation({
    mutationFn: async (paymentStatus: string) => {
      const { error } = await supabase.from("orders").update({ payment_status: paymentStatus as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast({ title: "Payment status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return <div className="py-12 text-center text-muted-foreground">Order not found.</div>;
  }

  const currentStepIdx = STEPS.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "CANCELLED";
  const canAdvance = appUser?.role === "OWNER" || appUser?.role === "ADMIN" || appUser?.role === "STAFF";
  const total = items.reduce((sum: number, i: any) => sum + Number(i.line_total), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Order #{order.id.slice(0, 8)}</h2>
          <p className="text-sm text-muted-foreground">
            Created {format(new Date(order.created_at), "dd MMM yyyy, HH:mm")}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <StatusBadge status={statusToBadge[order.status] || "pending"} />
          <StatusBadge status={paymentToBadge[order.payment_status] || "pending"} />
        </div>
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                        isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn("mt-2 text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>{step.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn("mx-2 h-0.5 flex-1", idx < currentStepIdx ? "bg-primary" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>
          {canAdvance && currentStepIdx < STEPS.length - 1 && currentStepIdx >= 0 && (
            <div className="mt-4 flex justify-end gap-2">
              <Button
                size="sm"
                onClick={() => updateStatus.mutate(STEPS[currentStepIdx + 1].key)}
                disabled={updateStatus.isPending}
              >
                Mark as {STEPS[currentStepIdx + 1].label}
              </Button>
              {order.status !== "CANCELLED" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => updateStatus.mutate("CANCELLED")}
                  disabled={updateStatus.isPending}
                >
                  Cancel Order
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {isCancelled && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm font-semibold text-destructive">This order has been cancelled.</p>
        </div>
      )}

      {/* Order info cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Buyer</p>
          <p className="text-sm font-medium text-foreground">{order.buyer?.name}</p>
          <p className="text-xs text-muted-foreground">{order.buyer?.category} · {order.buyer?.phone || "No phone"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Delivery</p>
          <p className="text-sm font-medium text-foreground">
            {order.delivery_date ? format(new Date(order.delivery_date), "dd MMM yyyy") : "Not set"}
          </p>
          <p className="text-xs text-muted-foreground">{order.delivery_slot || "No slot"} · {order.shop?.name || "No shop"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Created By</p>
          <p className="text-sm font-medium text-foreground">{order.created_by?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">Channel: {order.channel}</p>
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/50 px-4 py-2">
          <h3 className="text-sm font-semibold text-foreground">Order Items</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Product</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">Brand</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Requested</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Allocated</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Unit Price</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-muted-foreground text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{item.product?.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{item.product?.brand?.name || "—"}</td>
                <td className="px-4 py-3 text-sm text-right text-foreground">{Number(item.requested_qty)}</td>
                <td className={cn(
                  "px-4 py-3 text-sm text-right font-medium",
                  Number(item.allocated_qty) < Number(item.requested_qty) ? "text-warning" : "text-foreground"
                )}>
                  {Number(item.allocated_qty)}
                </td>
                <td className="px-4 py-3 text-sm text-right text-muted-foreground">₹{Number(item.unit_price)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-foreground">₹{Number(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30">
              <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-foreground text-right">Grand Total</td>
              <td className="px-4 py-3 text-sm font-bold text-foreground text-right">₹{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment Section */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Payment Status</p>
            <div className="mt-1">
              <StatusBadge status={paymentToBadge[order.payment_status] || "pending"} />
            </div>
          </div>
          {canAdvance && (
            <div className="flex gap-2">
              {order.payment_status !== "PARTIAL" && (
                <Button size="sm" variant="outline" onClick={() => updatePayment.mutate("PARTIAL")} disabled={updatePayment.isPending}>
                  Mark Partial
                </Button>
              )}
              {order.payment_status !== "PAID" && (
                <Button size="sm" onClick={() => updatePayment.mutate("PAID")} disabled={updatePayment.isPending}>
                  Mark Paid
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Info */}
      {dispatch && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Dispatch Info</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Driver:</span>{" "}
              <span className="font-medium text-foreground">{dispatch.driver?.name || "Unassigned"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vehicle:</span>{" "}
              <span className="font-medium text-foreground">{dispatch.vehicle_id || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span>{" "}
              <span className="font-medium text-foreground">{format(new Date(dispatch.dispatch_date), "dd MMM yyyy")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <StatusBadge status={statusToBadge[dispatch.status] || "pending"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
