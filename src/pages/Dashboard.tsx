import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Package, ShoppingCart, Truck, Users } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const statusToBadge: Record<string, any> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  DISPATCHED: "dispatched",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();


  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", today],
    enabled: !!appUser && appUser.role !== "SALESMAN",
    queryFn: async () => {
      const [products, ordersActive, ordersPending, dispatchesToday, dispatchesTransit, buyersActive, buyersNew] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["PENDING", "CONFIRMED"]),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("dispatches").select("id", { count: "exact", head: true }).eq("dispatch_date", today),
        supabase.from("dispatches").select("id", { count: "exact", head: true }).eq("dispatch_date", today).eq("status", "IN_TRANSIT"),
        supabase.from("buyers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("buyers").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      ]);
      return {
        totalProducts: products.count ?? 0,
        activeOrders: ordersActive.count ?? 0,
        pendingOrders: ordersPending.count ?? 0,
        dispatchesToday: dispatchesToday.count ?? 0,
        dispatchesTransit: dispatchesTransit.count ?? 0,
        activeBuyers: buyersActive.count ?? 0,
        newBuyers: buyersNew.count ?? 0,
      };
    },
  });

  const { data: recentOrders = [] } = useQuery({
    queryKey: ["dashboard-recent-orders", appUser?.id, appUser?.role],
    enabled: !!appUser,
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, buyer:buyers(name)")
        .order("created_at", { ascending: false })
        .limit(10);

      if (appUser?.role === "SALESMAN") {
        query = query.eq("created_by_user_id", appUser.id);
      }

      const { data: orders } = await query;
      if (!orders) return [];
      const ids = orders.map((o: any) => o.id);
      const { data: items } = await supabase.from("order_items").select("order_id, line_total").in("order_id", ids);
      return orders.map((o: any) => {
        const myItems = (items || []).filter((i: any) => i.order_id === o.id);
        return {
          ...o,
          itemsCount: myItems.length,
          total: myItems.reduce((s: number, i: any) => s + Number(i.line_total || 0), 0),
        };
      });
    },
  });

  const cards = [
    { label: "Total Products", value: stats?.totalProducts ?? "—", icon: Package, change: "Active SKUs", route: "/inventory" },
    { label: "Active Orders", value: stats?.activeOrders ?? "—", icon: ShoppingCart, change: `${stats?.pendingOrders ?? 0} pending`, route: "/orders" },
    { label: "Dispatches Today", value: stats?.dispatchesToday ?? "—", icon: Truck, change: `${stats?.dispatchesTransit ?? 0} in transit`, route: "/dispatch" },
    { label: "Active Buyers", value: stats?.activeBuyers ?? "—", icon: Users, change: `+${stats?.newBuyers ?? 0} new`, route: "/buyers" },
  ];

  return (
    <div className="space-y-6">
      {appUser?.role !== "SALESMAN" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((stat) => (
            <button
              key={stat.label}
              onClick={() => navigate(stat.route)}
              className="rounded-lg border border-border bg-card p-5 shadow-sm text-left hover:border-primary/40 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Order #</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Buyer</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Items</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Total</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">No orders yet.</td></tr>
              ) : recentOrders.map((order: any) => (
                <tr
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40"
                >
                  <td className="px-5 py-3 text-sm font-mono font-medium text-foreground">#{order.order_number || order.id.slice(0, 8)}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{order.buyer?.name || "—"}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{order.itemsCount}</td>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">₹{order.total.toFixed(2)}</td>
                  <td className="px-5 py-3"><StatusBadge status={statusToBadge[order.status] || "pending"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
