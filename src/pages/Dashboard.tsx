import { Package, ShoppingCart, Truck, Users } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

const stats = [
  { label: "Total Products", value: "248", icon: Package, change: "+12 this week" },
  { label: "Active Orders", value: "34", icon: ShoppingCart, change: "5 pending" },
  { label: "Dispatches Today", value: "8", icon: Truck, change: "2 in transit" },
  { label: "Active Buyers", value: "156", icon: Users, change: "+3 new" },
];

const recentOrders = [
  { id: "ORD-001", buyer: "Acme Corp", items: 5, total: "$1,240", status: "confirmed" as const },
  { id: "ORD-002", buyer: "Beta Foods", items: 3, total: "$890", status: "pending" as const },
  { id: "ORD-003", buyer: "Chef's Supply", items: 8, total: "$2,100", status: "confirmed" as const },
  { id: "ORD-004", buyer: "Delta Market", items: 2, total: "$340", status: "cancelled" as const },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Order ID</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Buyer</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Items</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Total</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{order.id}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{order.buyer}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{order.items}</td>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{order.total}</td>
                  <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
