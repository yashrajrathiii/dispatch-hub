import { cn } from "@/lib/utils";

export type Status = "ok" | "confirmed" | "low" | "low_stock" | "pending" | "out_of_stock" | "cancelled";

const statusConfig: Record<Status, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-success/10 text-success" },
  confirmed: { label: "Confirmed", className: "bg-success/10 text-success" },
  low: { label: "Low", className: "bg-warning/10 text-warning" },
  low_stock: { label: "Low Stock", className: "bg-destructive/10 text-destructive" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning" },
  out_of_stock: { label: "Out of Stock", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
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
