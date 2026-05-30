import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowLeft, Check, Truck, Package, MapPin, Trash2 } from "lucide-react";

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
  PICKED_UP: "picked_up",
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
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const total = items.reduce((sum: number, i: any) => sum + Number(i.line_total), 0);
  const amountPaid = Number(order?.amount_paid || 0);
  const remaining = Math.max(0, total - amountPaid);

  const adjustInventory = async (direction: "deduct" | "restock") => {
    if (!order || !order.shop_id || !appUser) return;
    for (const item of items) {
      const qty = Number(item.allocated_qty);
      if (!qty) continue;
      const { data: inv } = await supabase
        .from("inventory")
        .select("id, quantity")
        .eq("shop_id", order.shop_id)
        .eq("product_id", item.product_id)
        .maybeSingle();
      if (inv) {
        const change = direction === "deduct" ? -qty : qty;
        await supabase.from("inventory").update({
          quantity: Number(inv.quantity) + change,
          last_updated_at: new Date().toISOString(),
          updated_by_user_id: appUser.id,
        }).eq("id", inv.id);
      }
      await supabase.from("inventory_logs").insert({
        shop_id: order.shop_id,
        product_id: item.product_id,
        change_type: (direction === "deduct" ? "SOLD" : "ADJUSTED") as any,
        quantity_change: direction === "deduct" ? -qty : qty,
        note: direction === "deduct"
          ? `Deducted on Order Confirm #${order.id.slice(0, 8)}`
          : `Restocked on Order Cancel #${order.id.slice(0, 8)}`,
        created_by_user_id: appUser.id,
      });
    }
  };

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const prev = order?.status;
      const { error } = await supabase.from("orders").update({ status: newStatus as any }).eq("id", id!);
      if (error) throw error;
      if (newStatus === "CONFIRMED" && prev !== "CONFIRMED") {
        await adjustInventory("deduct");
      } else if (newStatus === "CANCELLED" && prev === "CONFIRMED") {
        await adjustInventory("restock");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const recordPayment = useMutation({
    mutationFn: async (additionalAmount: number) => {
      const newPaid = amountPaid + additionalAmount;
      const newStatus = newPaid >= total ? "PAID" : "PARTIAL";
      const { error } = await supabase
        .from("orders")
        .update({ amount_paid: newPaid, payment_status: newStatus as any })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      setPartialOpen(false);
      setPartialAmount("");
      toast({ title: "Payment updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const markFullyPaid = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ amount_paid: total, payment_status: "PAID" as any })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast({ title: "Marked as paid" });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async () => {
      await supabase.from("order_items").delete().eq("order_id", id!);
      const { error } = await supabase.from("orders").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order deleted" });
      navigate("/orders");
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
        <div className="rounded-lg border border-gray-200 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = idx <= currentStepIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                        isActive ? "border-primary bg-primary text-primary-foreground" : "border-gray-300 bg-card text-muted-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn("mt-2 text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>{step.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn("mx-2 h-0.5 flex-1", idx < currentStepIdx ? "bg-primary" : "bg-gray-200")} />
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
        <div className="rounded-lg border border-gray-200 bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Buyer</p>
          <p className="text-sm font-medium text-foreground">{order.buyer?.name}</p>
          <p className="text-[11px] text-muted-foreground font-mono">ID: {order.buyer?.id?.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{order.buyer?.category} · {order.buyer?.phone || "No phone"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Delivery</p>
          <p className="text-sm font-medium text-foreground">
            {order.delivery_date ? format(new Date(order.delivery_date), "dd MMM yyyy") : "Not set"}
          </p>
          <p className="text-xs text-muted-foreground">{order.shop?.name || "No godown"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Created By</p>
          <p className="text-sm font-medium text-foreground">{order.created_by?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">Channel: {order.channel}</p>
        </div>
      </div>

      {/* Item List */}
      <div className="rounded-lg border border-gray-200 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-muted/50 px-4 py-2">
          <h3 className="text-sm font-semibold text-foreground">Item List</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left">
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
              <tr key={item.id} className="border-b border-gray-200 last:border-0">
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
            <tr className="border-t border-gray-200 bg-muted/30">
              <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-foreground text-right">Grand Total</td>
              <td className="px-4 py-3 text-sm font-bold text-foreground text-right">₹{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment Section */}
      <div className="rounded-lg border border-gray-200 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Payment Status</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={paymentToBadge[order.payment_status] || "pending"} />
              {amountPaid > 0 && order.payment_status !== "PAID" && (
                <span className="text-xs text-muted-foreground">Paid ₹{amountPaid}</span>
              )}
            </div>
            {order.payment_status === "PARTIAL" && remaining > 0 && (
              <p className="mt-1 text-sm font-medium text-destructive">Partial — ₹{remaining} remaining</p>
            )}
          </div>
          {canAdvance && order.payment_status !== "PAID" && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-gray-300" onClick={() => { setPartialAmount(""); setPartialOpen(true); }}>
                {order.payment_status === "PARTIAL" ? "Update Payment" : "Mark Partial"}
              </Button>
              <Button size="sm" onClick={() => markFullyPaid.mutate()} disabled={markFullyPaid.isPending}>
                Mark Paid
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Info */}
      {dispatch && (
        <div className="rounded-lg border border-gray-200 bg-card p-4 shadow-sm">
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

      {/* Delete Order */}
      {canAdvance && (
        <div className="flex justify-end">
          <Button variant="destructive" className="gap-2" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete Order
          </Button>
        </div>
      )}

      {/* Partial Payment Dialog */}
      <Dialog open={partialOpen} onOpenChange={setPartialOpen}>
        <DialogContent className="border border-gray-200">
          <DialogHeader>
            <DialogTitle>Record Partial Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Total: ₹{total} · Already paid: ₹{amountPaid} · Remaining: ₹{remaining}
            </div>
            <div className="space-y-1">
              <Label>Amount Paid (₹)</Label>
              <Input
                type="number"
                min="0"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-300" onClick={() => setPartialOpen(false)}>Cancel</Button>
            <Button
              onClick={() => recordPayment.mutate(Number(partialAmount))}
              disabled={!partialAmount || Number(partialAmount) <= 0 || recordPayment.isPending}
            >
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this order? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteOrder.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
