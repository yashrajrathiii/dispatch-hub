import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Save } from "lucide-react";
import { useState } from "react";

export default function SettingsLocations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { lat: string; lng: string }>>({});

  const { data: shops = [] } = useQuery({
    queryKey: ["all-shops-locations"],
    queryFn: async () => {
      const { data } = await supabase.from("shops").select("*").order("type").order("name");
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, lat, lng }: { id: string; lat: number; lng: number }) => {
      const { error } = await supabase
        .from("shops")
        .update({ latitude: lat, longitude: lng })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Coordinates saved" });
      queryClient.invalidateQueries({ queryKey: ["all-shops-locations"] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleEdit = (id: string, field: "lat" | "lng", value: string) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = (id: string, currentLat: number | null, currentLng: number | null) => {
    const edit = edits[id];
    const lat = edit?.lat !== undefined ? parseFloat(edit.lat) : currentLat;
    const lng = edit?.lng !== undefined ? parseFloat(edit.lng) : currentLng;
    if (lat === null || lng === null || isNaN(lat!) || isNaN(lng!)) {
      toast({ title: "Invalid coordinates", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id, lat: lat!, lng: lng! });
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Locations & Coordinates</h2>
        <p className="text-sm text-muted-foreground">Set latitude/longitude for shops and godowns used in dispatch routing</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Latitude</TableHead>
                  <TableHead>Longitude</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.map((shop: any) => {
                  const edit = edits[shop.id];
                  const latVal = edit?.lat !== undefined ? edit.lat : (shop.latitude?.toString() || "");
                  const lngVal = edit?.lng !== undefined ? edit.lng : (shop.longitude?.toString() || "");
                  const hasChanges = edit?.lat !== undefined || edit?.lng !== undefined;

                  return (
                    <TableRow key={shop.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {shop.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={shop.type === "GODOWN" ? "default" : "secondary"}>
                          {shop.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{shop.city || "—"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          className="w-32 h-8 text-sm"
                          value={latVal}
                          onChange={(e) => handleEdit(shop.id, "lat", e.target.value)}
                          placeholder="e.g. 26.9124"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          className="w-32 h-8 text-sm"
                          value={lngVal}
                          onChange={(e) => handleEdit(shop.id, "lng", e.target.value)}
                          placeholder="e.g. 75.7873"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={hasChanges ? "default" : "ghost"}
                          className="h-8"
                          disabled={!hasChanges || updateMutation.isPending}
                          onClick={() => handleSave(shop.id, shop.latitude, shop.longitude)}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
