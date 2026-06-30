import { useNavigate } from "react-router-dom";
import { Building2, Tag, MapPin, Users, Key, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SettingSection {
  title: string;
  description: string;
  url: string;
  icon: any;
}

const allSections: SettingSection[] = [
  { title: "Shops", description: "Manage godowns and shop locations", url: "/settings/shops", icon: Building2 },
  { title: "Brands", description: "Manage product brands", url: "/settings/brands", icon: Tag },
  { title: "Locations", description: "Manage delivery locations", url: "/settings/locations", icon: MapPin },
  { title: "Users", description: "Manage team members and roles", url: "/settings/users", icon: Users },
  { title: "Security", description: "Password and account security", url: "/settings/security", icon: Key },
];

export default function SettingsIndex() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const roles = appUser?.role ?? ["STAFF"];

  const sections = allSections.filter((section) => {
    if (section.url === "/settings/users") {
      return roles.includes("OWNER");
    }
    if (
      section.url === "/settings/shops" ||
      section.url === "/settings/brands" ||
      section.url === "/settings/locations"
    ) {
      return roles.includes("OWNER") || roles.includes("ADMIN");
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <button
            key={section.url}
            onClick={() => navigate(section.url)}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <section.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{section.title}</p>
              <p className="truncate text-sm text-muted-foreground">{section.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
