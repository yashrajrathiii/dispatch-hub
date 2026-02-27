import { Construction } from "lucide-react";

interface Props {
  title: string;
}

export default function PlaceholderPage({ title }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Construction className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-muted-foreground">This section is under construction. Check back soon!</p>
    </div>
  );
}
