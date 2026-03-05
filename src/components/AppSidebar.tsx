import {
  LayoutDashboard,
  Package,
  DollarSign,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Settings,
  Building2,
  Tag,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, AppRole } from "@/contexts/AuthContext";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: AppRole[];
  children?: { title: string; url: string; icon: any }[];
}

const allItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT", "DRIVER"] },
  { title: "Inventory", url: "/inventory", icon: Package, roles: ["OWNER", "ADMIN", "STAFF"] },
  { title: "Price List", url: "/price-list", icon: DollarSign, roles: ["OWNER", "ADMIN", "STAFF"] },
  { title: "Orders", url: "/orders", icon: ShoppingCart, roles: ["OWNER", "ADMIN", "STAFF"] },
  { title: "Walk-in Purchase", url: "/walk-in", icon: Store, roles: ["OWNER", "ADMIN", "STAFF"] },
  { title: "Dispatch", url: "/dispatch", icon: Truck, roles: ["OWNER", "ADMIN", "STAFF", "DRIVER"] },
  { title: "Buyers", url: "/buyers", icon: Users, roles: ["OWNER", "ADMIN", "STAFF"] },
  {
    title: "Settings", url: "/settings", icon: Settings, roles: ["OWNER", "ADMIN"],
    children: [
      { title: "Shops", url: "/settings/shops", icon: Building2 },
      { title: "Brands", url: "/settings/brands", icon: Tag },
    ],
  },
];

export default function AppSidebar() {
  const { appUser } = useAuth();
  const role = appUser?.role ?? "STAFF";
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
                end={item.url === "/" || !!item.children}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeClassName="bg-sidebar-accent text-primary border-l-[3px] border-primary font-semibold"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </NavLink>
              {item.children && (
                <ul className="ml-6 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <li key={child.title}>
                      <NavLink
                        to={child.url}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        activeClassName="text-primary font-semibold"
                      >
                        <child.icon className="h-4 w-4" />
                        <span>{child.title}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
