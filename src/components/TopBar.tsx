import { Bell, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
}

export default function TopBar({ title }: Props) {
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = appUser?.name
    ? appUser.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : appUser?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-4">
        <button className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            3
          </span>
        </button>

        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-none">{appUser?.name || appUser?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{appUser?.role?.toLowerCase()}</p>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
