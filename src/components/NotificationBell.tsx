import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Bell, Receipt, Package, ShoppingCart, Truck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const typeIcons: Record<string, any> = {
  BILLING: Receipt,
  LOW_STOCK: Package,
  ORDER: ShoppingCart,
  DISPATCH: Truck,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", appUser?.id],
    queryFn: async () => {
      if (!appUser) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_user_id", appUser.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!appUser,
  });

  // Realtime subscription
  useEffect(() => {
    if (!appUser) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${appUser.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", appUser.id] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [appUser?.id, queryClient]);

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!appUser) return;
      const unreadIds = notifications.filter((n: any) => !n.is_read).map((n: any) => n.id);
      if (unreadIds.length === 0) return;
      await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", appUser?.id] }),
  });

  const handleClick = (notif: any) => {
    // Mark as read
    if (!notif.is_read) {
      supabase.from("notifications").update({ is_read: true }).eq("id", notif.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications", appUser?.id] });
      });
    }
    setOpen(false);
    if (notif.reference_type === "WALKIN" && notif.reference_id) {
      navigate(`/billing/${notif.reference_id}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => markAllRead.mutate()}>
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            notifications.map((notif: any) => {
              const Icon = typeIcons[notif.type] || Bell;
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors ${!notif.is_read ? "bg-accent/50" : ""}`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                      {!notif.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
