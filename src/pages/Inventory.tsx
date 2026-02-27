import StatusBadge from "@/components/StatusBadge";

const items = [
  { name: "Basmati Rice (25kg)", sku: "INV-001", qty: 120, threshold: 20, status: "ok" as const },
  { name: "Olive Oil (5L)", sku: "INV-002", qty: 8, threshold: 10, status: "low" as const },
  { name: "Flour (50kg)", sku: "INV-003", qty: 0, threshold: 15, status: "out_of_stock" as const },
  { name: "Sugar (10kg)", sku: "INV-004", qty: 45, threshold: 10, status: "ok" as const },
  { name: "Salt (1kg)", sku: "INV-005", qty: 6, threshold: 10, status: "low" as const },
];

export default function Inventory() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Inventory Items</h2>
      </div>
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Product</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">SKU</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Quantity</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Threshold</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.sku} className="border-b border-border last:border-0">
                <td className="px-5 py-3 text-sm font-medium text-foreground">{item.name}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{item.sku}</td>
                <td className="px-5 py-3 text-sm text-foreground">{item.qty}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{item.threshold}</td>
                <td className="px-5 py-3"><StatusBadge status={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
