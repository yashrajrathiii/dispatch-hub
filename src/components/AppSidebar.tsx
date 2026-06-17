import {
  LayoutDashboard,
  Package,
  IndianRupee,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Settings,
  Building2,
  Tag,
  Receipt,
  MapPin,
  Navigation,
  X,
  Key,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: AppRole[];
  children?: { title: string; url: string; icon: any }[];
}

const allItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT", "DRIVER", "SALESMAN"] },
  { title: "Inventory", url: "/inventory", icon: Package, roles: ["OWNER", "ADMIN", "STAFF"] },
  { title: "Price List", url: "/price-list", icon: IndianRupee, roles: ["OWNER", "ADMIN", "SALESMAN"] },
  { title: "Orders", url: "/orders", icon: ShoppingCart, roles: ["OWNER", "ADMIN", "STAFF", "SALESMAN"] },
  { title: "Walk-in Purchase", url: "/walk-in", icon: Store, roles: ["OWNER", "ADMIN", "STAFF"] },
  { title: "Billing", url: "/billing", icon: Receipt, roles: ["OWNER", "ADMIN", "ACCOUNTANT"] },
  { title: "Dispatch", url: "/dispatch", icon: Truck, roles: ["OWNER", "ADMIN", "STAFF"] },
  { title: "My Deliveries", url: "/driver", icon: Navigation, roles: ["DRIVER"] },
  { title: "Buyers", url: "/buyers", icon: Users, roles: ["OWNER", "ADMIN", "STAFF"] },
  {
    title: "Settings", url: "/settings", icon: Settings, roles: ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT", "DRIVER", "SALESMAN"],
    children: [
      { title: "Shops", url: "/settings/shops", icon: Building2 },
      { title: "Brands", url: "/settings/brands", icon: Tag },
      { title: "Locations", url: "/settings/locations", icon: MapPin },
      { title: "Users", url: "/settings/users", icon: Users },
      { title: "Security", url: "/settings/security", icon: Key },
    ],
  },
];

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const { appUser } = useAuth();
  const role = appUser?.role ?? "STAFF";
  const items = allItems
    .map((item) => {
      if (item.title === "Settings") {
        return {
          ...item,
          children: item.children?.filter((child) => {
            if (child.url === "/settings/users") {
              return role === "OWNER";
            }
            if (
              child.url === "/settings/shops" ||
              child.url === "/settings/brands" ||
              child.url === "/settings/locations"
            ) {
              return role === "OWNER" || role === "ADMIN";
            }
            return true;
          }),
        };
      }
      return item;
    })
    .filter((item) => item.roles.includes(role));

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out lg:translate-x-0 lg:z-30",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <Truck className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold text-foreground">DispatchOps</span>
        </div>
        <button 
          onClick={onClose} 
          className="lg:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
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
                onClick={onClose}
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
                        onClick={onClose}
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
