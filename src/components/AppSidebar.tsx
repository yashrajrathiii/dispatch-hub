import {
  LayoutDashboard,
  Package,
  DollarSign,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";

const allItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["owner", "admin", "staff", "accountant", "driver"] },
  { title: "Inventory", url: "/inventory", icon: Package, roles: ["owner", "admin", "staff"] },
  { title: "Price List", url: "/price-list", icon: DollarSign, roles: ["owner", "admin", "staff"] },
  { title: "Orders", url: "/orders", icon: ShoppingCart, roles: ["owner", "admin", "staff"] },
  { title: "Walk-in Purchase", url: "/walk-in", icon: Store, roles: ["owner", "admin", "staff"] },
  { title: "Dispatch", url: "/dispatch", icon: Truck, roles: ["owner", "admin", "staff", "driver"] },
  { title: "Buyers", url: "/buyers", icon: Users, roles: ["owner", "admin", "staff"] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["owner", "admin"] },
];

export default function AppSidebar() {
  const { profile } = useAuth();
  const role = profile?.role ?? "staff";
  const items = allItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Truck className="h-7 w-7 text-primary" />
        <span className="text-lg font-bold text-foreground">DispatchOps</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.title}>
              <NavLink
                to={item.url}
                end={item.url === "/"}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeClassName="bg-sidebar-accent text-primary border-l-[3px] border-primary font-semibold"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
