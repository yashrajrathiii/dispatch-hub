import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, CheckCircle2, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const stopStatusColors: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  DELIVERED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

function MapRecenter({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 12); }, [center, map]);
  return null;
}

export default function DriverView() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: ["driver-dispatches", appUser?.id],
    queryFn: async () => {
      if (!appUser) return [];
      const { data } = await supabase
        .from("dispatches")
        .select("*, start_shop:shops(*), dispatch_stops(*, buyer:buyers(name, address, phone))")
        .eq("driver_user_id", appUser.id)
        .eq("dispatch_date", today)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!appUser,
  });

  const markDelivered = useMutation({
    mutationFn: async ({ stopId, dispatchId }: { stopId: string; dispatchId: string }) => {
      const { error } = await supabase
        .from("dispatch_stops")
        .update({ status: "DELIVERED" as const, completed_at: new Date().toISOString() })
        .eq("id", stopId);
      if (error) throw error;

      // Check if all stops done
      const { data: allStops } = await supabase
        .from("dispatch_stops")
        .select("status")
        .eq("dispatch_id", dispatchId);

      const allDone = allStops?.every((s: any) => s.status === "DELIVERED" || s.status === "FAILED");
      if (allDone) {
        await supabase.from("dispatches").update({ status: "COMPLETED" as const }).eq("id", dispatchId);
      }
    },
    onSuccess: () => {
      toast({ title: "Stop marked as delivered" });
      queryClient.invalidateQueries({ queryKey: ["driver-dispatches"] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">My Deliveries</h2>
        <p className="text-sm text-muted-foreground">Today's dispatches assigned to you</p>
      </div>

      {dispatches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Truck className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No dispatches assigned for today</p>
          </CardContent>
        </Card>
      ) : (
        dispatches.map((dispatch: any) => {
          const expanded = expandedId === dispatch.id;
          const stops = (dispatch.dispatch_stops || []).sort((a: any, b: any) => a.stop_sequence - b.stop_sequence);
          const delivered = stops.filter((s: any) => s.status === "DELIVERED").length;
          const shop = dispatch.start_shop;
          const mapCenter: [number, number] | null =
            shop?.latitude && shop?.longitude ? [Number(shop.latitude), Number(shop.longitude)] : null;

          return (
            <Card key={dispatch.id} className="overflow-hidden">
              <button
                className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedId(expanded ? null : dispatch.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Truck className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <p className="font-semibold">{shop?.name || "Dispatch"}</p>
                    <p className="text-xs text-muted-foreground">
                      {delivered}/{stops.length} stops delivered
                      {dispatch.total_distance_km && ` · ${dispatch.total_distance_km} km`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={dispatch.status === "COMPLETED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                    {dispatch.status}
                  </Badge>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {expanded && (
                <CardContent className="pt-0 space-y-4">
                  {/* Map */}
                  <div className="h-[300px] md:h-[350px] rounded-lg overflow-hidden border">
                    <MapContainer center={mapCenter || [26.9, 75.8]} zoom={12} style={{ height: "100%", width: "100%" }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                      <MapRecenter center={mapCenter} />
                      {mapCenter && (
                        <Marker position={mapCenter} icon={blueIcon}>
                          <Popup>{shop?.name}</Popup>
                        </Marker>
                      )}
                      {stops.map((s: any, i: number) =>
                        s.latitude && s.longitude ? (
                          <Marker
                            key={s.id}
                            position={[Number(s.latitude), Number(s.longitude)]}
                            icon={s.status === "DELIVERED" ? greenIcon : redIcon}
                          >
                            <Popup>Stop {i + 1}: {s.buyer?.name}</Popup>
                          </Marker>
                        ) : null
                      )}
                    </MapContainer>
                  </div>

                  {/* Stops */}
                  <div className="space-y-2">
                    {stops.map((s: any, i: number) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-sm">
                            {i + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{s.buyer?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.address || s.buyer?.address || "—"}</p>
                            {s.items_summary?.text && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{s.items_summary.text}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <Badge className={stopStatusColors[s.status] || ""}>
                            {s.status}
                          </Badge>
                          {s.status === "PENDING" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white h-12 min-w-[120px]"
                              onClick={() => markDelivered.mutate({ stopId: s.id, dispatchId: dispatch.id })}
                              disabled={markDelivered.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Mark Delivered
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
