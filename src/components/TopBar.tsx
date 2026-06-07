import { LogOut, Menu, Truck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";

interface Props {
  title: string;
  onMenuClick: () => void;
}

export default function TopBar({ title, onMenuClick }: Props) {
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
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onMenuClick} 
          className="lg:hidden text-muted-foreground -ml-2 mr-1"
        >
          <Menu className="h-6 w-6" />
        </Button>
        
        <div className="flex items-center gap-1.5 lg:hidden mr-1">
          <Truck className="h-5 w-5 text-primary" />
          <span className="text-sm font-bold text-foreground">DispatchOps</span>
        </div>

        <h1 className="text-base sm:text-xl font-semibold text-foreground border-l border-border pl-3 lg:border-0 lg:pl-0">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />

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
