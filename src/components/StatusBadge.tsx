import { cn } from "@/lib/utils";

export type Status = "ok" | "confirmed" | "low" | "low_stock" | "pending" | "out_of_stock" | "cancelled" | "dispatched" | "delivered" | "partial" | "paid" | "planned" | "in_transit" | "completed";

const statusConfig: Record<Status, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-success/10 text-success" },
  confirmed: { label: "Confirmed", className: "bg-success/10 text-success" },
  low: { label: "Low", className: "bg-warning/10 text-warning" },
  low_stock: { label: "Low Stock", className: "bg-destructive/10 text-destructive" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning" },
  out_of_stock: { label: "Out of Stock", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  dispatched: { label: "Dispatched", className: "bg-primary/10 text-primary" },
  delivered: { label: "Delivered", className: "bg-success/10 text-success" },
  partial: { label: "Partial", className: "bg-warning/10 text-warning" },
  paid: { label: "Paid", className: "bg-success/10 text-success" },
  planned: { label: "Planned", className: "bg-muted text-muted-foreground" },
  in_transit: { label: "In Transit", className: "bg-primary/10 text-primary" },
  completed: { label: "Completed", className: "bg-success/10 text-success" },
};

interface Props {
  status: Status;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", config.className, className)}>
      {config.label}
    </span>
  );
}
