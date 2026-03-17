import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Plus, MapPin, Route, Truck, Warehouse, Eye, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
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

function MapRecenter({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, 12); }, [center, map]);
  return null;
}

const statusColors: Record<string, string> = {
  PLANNED: "bg-amber-100 text-amber-800",
  IN_TRANSIT: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

interface Stop {
  buyer_name: string;
  buyer_id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  items_summary: string;
  order_id: string;
}

export default function Dispatch() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showPlanner, setShowPlanner] = useState(false);
  const [step, setStep] = useState(1);
  const [date, setDate] = useState<Date>(new Date());
  const [godownId, setGodownId] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [stops, setStops] = useState<Stop[]>([]);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  // Queries
  const { data: godowns = [] } = useQuery({
    queryKey: ["godowns"],
    queryFn: async () => {
      const { data } = await supabase.from("shops").select("*").eq("type", "GODOWN").eq("is_active", true);
      return data || [];
    },
  });

  const { data: confirmedOrders = [] } = useQuery({
    queryKey: ["confirmed-orders", format(date, "yyyy-MM-dd"), godownId],
    queryFn: async () => {
      if (!godownId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*, buyer:buyers(*), order_items(*, product:products(name))")
        .eq("status", "CONFIRMED")
        .eq("shop_id", godownId);
      return data || [];
    },
    enabled: !!godownId,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data } = await supabase.from("users").select("*").eq("role", "DRIVER").eq("is_active", true);
      return data || [];
    },
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ["dispatches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dispatches")
        .select("*, start_shop:shops(name), driver:users(name), dispatch_stops(id)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // When godown selected, center map
  useEffect(() => {
    if (godownId) {
      const g = godowns.find((s: any) => s.id === godownId);
      if (g?.latitude && g?.longitude) {
        setMapCenter([Number(g.latitude), Number(g.longitude)]);
      }
    }
  }, [godownId, godowns]);

  // Geocode stops
  const geocodeStops = useCallback(async () => {
    setGeocoding(true);
    const newStops: Stop[] = [];
    for (const orderId of selectedOrders) {
      const order = confirmedOrders.find((o: any) => o.id === orderId);
      if (!order) continue;
      const buyer = order.buyer;
      const address = buyer?.address || "";
      let lat: number | null = null;
      let lng: number | null = null;

      if (address) {
        try {
          const { data } = await supabase.functions.invoke("ors-proxy", {
            body: { action: "geocode", text: address },
          });
          if (data?.features?.[0]?.geometry?.coordinates) {
            const [lon, la] = data.features[0].geometry.coordinates;
            lat = la;
            lng = lon;
          }
        } catch (e) {
          console.error("Geocode error:", e);
        }
      }

      const itemsSummary = (order.order_items || [])
        .map((i: any) => `${i.product?.name} x${i.requested_qty}`)
        .join(", ");

      newStops.push({
        buyer_name: buyer?.name || "Unknown",
        buyer_id: buyer?.id || "",
        address,
        lat,
        lng,
        items_summary: itemsSummary,
        order_id: orderId,
      });
    }
    setStops(newStops);
    setGeocoding(false);
  }, [selectedOrders, confirmedOrders]);

  // Optimize route
  const optimizeRoute = useCallback(async () => {
    const godown = godowns.find((s: any) => s.id === godownId);
    if (!godown?.latitude || !godown?.longitude) {
      toast({ title: "Error", description: "Godown has no coordinates set", variant: "destructive" });
      return;
    }

    const validStops = stops.filter((s) => s.lat !== null && s.lng !== null);
    if (validStops.length === 0) {
      toast({ title: "Error", description: "No geocoded stops to optimize", variant: "destructive" });
      return;
    }

    setOptimizing(true);
    const coordinates = [
      [Number(godown.longitude), Number(godown.latitude)],
      ...validStops.map((s) => [s.lng!, s.lat!]),
    ];

    try {
      const { data } = await supabase.functions.invoke("ors-proxy", {
        body: { action: "directions", coordinates },
      });

      if (data?.features?.[0]) {
        const feature = data.features[0];
        const coords: [number, number][] = feature.geometry.coordinates.map(
          (c: number[]) => [c[1], c[0]] as [number, number]
        );
        setRouteCoords(coords);

        const summary = feature.properties?.summary;
        if (summary) {
          setRouteInfo({
            distance: Math.round((summary.distance / 1000) * 10) / 10,
            duration: Math.round(summary.duration / 60),
          });
        }

        // Reorder stops based on waypoint order if available
        const waypoints = data.metadata?.query?.coordinates;
        if (waypoints && waypoints.length > 1) {
          // Keep the same stops, they're already in order from the route
        }
      }
    } catch (e) {
      console.error("Route optimization error:", e);
      toast({ title: "Error", description: "Failed to optimize route", variant: "destructive" });
    }
    setOptimizing(false);
  }, [stops, godownId, godowns, toast]);

  // Save dispatch
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: dispatch, error: dErr } = await supabase
        .from("dispatches")
        .insert({
          dispatch_date: format(date, "yyyy-MM-dd"),
          start_shop_id: godownId,
          driver_user_id: driverId || null,
          vehicle_id: vehicleId || null,
          status: "PLANNED" as const,
          total_distance_km: routeInfo?.distance || null,
          total_duration_min: routeInfo?.duration || null,
        })
        .select()
        .single();
      if (dErr) throw dErr;

      // Create stops
      const stopRows = stops.map((s, i) => ({
        dispatch_id: dispatch.id,
        buyer_id: s.buyer_id || null,
        address: s.address,
        latitude: s.lat,
        longitude: s.lng,
        stop_sequence: i + 1,
        items_summary: { text: s.items_summary },
        status: "PENDING" as const,
      }));

      if (stopRows.length > 0) {
        const { error: sErr } = await supabase.from("dispatch_stops").insert(stopRows);
        if (sErr) throw sErr;
      }

      // Update orders to DISPATCHED
      for (const orderId of selectedOrders) {
        await supabase.from("orders").update({ status: "DISPATCHED" as const }).eq("id", orderId);
      }

      return dispatch;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Dispatch saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
      queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
      resetPlanner();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const resetPlanner = () => {
    setShowPlanner(false);
    setStep(1);
    setGodownId("");
    setSelectedOrders(new Set());
    setStops([]);
    setRouteCoords([]);
    setRouteInfo(null);
    setDriverId("");
    setVehicleId("");
  };

  const toggleOrder = (id: string) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedOrders.size === confirmedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(confirmedOrders.map((o: any) => o.id)));
    }
  };

  const godown = godowns.find((s: any) => s.id === godownId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dispatch & Route Planning</h2>
          <p className="text-sm text-muted-foreground">Plan delivery routes and manage dispatches</p>
        </div>
        {!showPlanner && (
          <Button onClick={() => setShowPlanner(true)} className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Create New Dispatch
          </Button>
        )}
      </div>

      {/* Planner */}
      {showPlanner && (
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">New Dispatch Planner</CardTitle>
              <div className="flex gap-2 text-sm text-muted-foreground">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                    step >= s ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 – Date & Godown */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Step 1 – Select Date & Starting Godown</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Dispatch Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(date, "PPP")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Starting Godown</Label>
                    <Select value={godownId} onValueChange={setGodownId}>
                      <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                      <SelectContent>
                        {godowns.map((g: any) => (
                          <SelectItem key={g.id} value={g.id}>
                            <div className="flex items-center gap-2">
                              <Warehouse className="h-4 w-4" />
                              {g.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => setStep(2)} disabled={!godownId} className="bg-green-600 hover:bg-green-700 text-white">
                  Next →
                </Button>
              </div>
            )}

            {/* Step 2 – Select Orders */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Step 2 – Select Orders</h3>
                  <span className="text-sm text-muted-foreground">{selectedOrders.size} selected</span>
                </div>
                {confirmedOrders.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No confirmed orders found for this godown.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Checkbox checked={selectedOrders.size === confirmedOrders.length && confirmedOrders.length > 0} onCheckedChange={toggleAll} />
                      <Label className="text-sm">Select All</Label>
                    </div>
                    <div className="rounded-md border max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Order #</TableHead>
                            <TableHead>Buyer</TableHead>
                            <TableHead>Address</TableHead>
                            <TableHead>Items</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {confirmedOrders.map((o: any) => (
                            <TableRow key={o.id}>
                              <TableCell>
                                <Checkbox checked={selectedOrders.has(o.id)} onCheckedChange={() => toggleOrder(o.id)} />
                              </TableCell>
                              <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                              <TableCell>{o.buyer?.name}</TableCell>
                              <TableCell className="max-w-48 truncate text-xs">{o.buyer?.address || "—"}</TableCell>
                              <TableCell className="text-xs">{o.order_items?.length || 0} items</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                  <Button onClick={async () => { await geocodeStops(); setStep(3); }} disabled={selectedOrders.size === 0 || geocoding} className="bg-green-600 hover:bg-green-700 text-white">
                    {geocoding ? "Geocoding..." : "Next → Geocode & Plot Stops"}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 – Map with stops */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Step 3 – Review Stops on Map</h3>
                <div className="h-[400px] rounded-lg overflow-hidden border">
                  <MapContainer
                    center={mapCenter || [26.9, 75.8]}
                    zoom={12}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <MapRecenter center={mapCenter} />

                    {/* Godown marker */}
                    {godown?.latitude && godown?.longitude && (
                      <Marker position={[Number(godown.latitude), Number(godown.longitude)]} icon={blueIcon}>
                        <Popup><strong>{godown.name}</strong> (Starting Godown)</Popup>
                      </Marker>
                    )}

                    {/* Stop markers */}
                    {stops.map((s, i) =>
                      s.lat && s.lng ? (
                        <Marker key={i} position={[s.lat, s.lng]} icon={redIcon}>
                          <Popup>
                            <strong>Stop {i + 1}: {s.buyer_name}</strong><br />
                            {s.address}
                          </Popup>
                        </Marker>
                      ) : null
                    )}

                    {/* Route polyline */}
                    {routeCoords.length > 0 && (
                      <Polyline positions={routeCoords} pathOptions={{ color: "#16a34a", weight: 4 }} />
                    )}
                  </MapContainer>
                </div>

                {/* Stops list */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Geocoded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stops.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-bold">{i + 1}</TableCell>
                          <TableCell>{s.buyer_name}</TableCell>
                          <TableCell className="max-w-48 truncate text-xs">{s.address || "—"}</TableCell>
                          <TableCell className="text-xs max-w-48 truncate">{s.items_summary}</TableCell>
                          <TableCell>
                            {s.lat ? (
                              <Badge className="bg-green-100 text-green-800">✓</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">✗</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
                  <Button onClick={() => setStep(4)} className="bg-green-600 hover:bg-green-700 text-white">
                    Next → Optimize Route
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4 – Optimize */}
            {step === 4 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Step 4 – Optimize Route</h3>
                <div className="h-[400px] rounded-lg overflow-hidden border">
                  <MapContainer center={mapCenter || [26.9, 75.8]} zoom={12} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                    <MapRecenter center={mapCenter} />
                    {godown?.latitude && godown?.longitude && (
                      <Marker position={[Number(godown.latitude), Number(godown.longitude)]} icon={blueIcon}>
                        <Popup><strong>{godown.name}</strong></Popup>
                      </Marker>
                    )}
                    {stops.map((s, i) =>
                      s.lat && s.lng ? (
                        <Marker key={i} position={[s.lat, s.lng]} icon={redIcon}>
                          <Popup>Stop {i + 1}: {s.buyer_name}</Popup>
                        </Marker>
                      ) : null
                    )}
                    {routeCoords.length > 0 && (
                      <Polyline positions={routeCoords} pathOptions={{ color: "#16a34a", weight: 4 }} />
                    )}
                  </MapContainer>
                </div>

                <Button
                  onClick={optimizeRoute}
                  disabled={optimizing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Route className="h-4 w-4 mr-2" />
                  {optimizing ? "Optimizing..." : "Optimize Route"}
                </Button>

                {routeInfo && (
                  <div className="flex gap-6 text-sm font-medium p-3 rounded-md bg-green-50 border border-green-200">
                    <span>📏 Estimated Distance: <strong>{routeInfo.distance} km</strong></span>
                    <span>⏱ Estimated Time: <strong>{routeInfo.duration} mins</strong></span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
                  <Button onClick={() => setStep(5)} className="bg-green-600 hover:bg-green-700 text-white">
                    Next → Assign & Save
                  </Button>
                </div>
              </div>
            )}

            {/* Step 5 – Assign & Save */}
            {step === 5 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Step 5 – Assign Driver & Save</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Driver</Label>
                    <Select value={driverId} onValueChange={setDriverId}>
                      <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                      <SelectContent>
                        {drivers.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle ID</Label>
                    <Input value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} placeholder="e.g. RJ-14-AB-1234" />
                  </div>
                </div>

                <div className="rounded-md bg-muted p-4 text-sm space-y-1">
                  <p><strong>Summary:</strong></p>
                  <p>Date: {format(date, "PPP")}</p>
                  <p>Godown: {godown?.name}</p>
                  <p>Stops: {stops.length}</p>
                  {routeInfo && <p>Distance: {routeInfo.distance} km | Time: {routeInfo.duration} mins</p>}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(4)}>← Back</Button>
                  <Button variant="outline" onClick={resetPlanner}>Cancel</Button>
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? "Saving..." : "Save Dispatch"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dispatch List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dispatch History</CardTitle>
        </CardHeader>
        <CardContent>
          {dispatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No dispatches yet</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Starting Godown</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Stops</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatches.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.dispatch_date}</TableCell>
                      <TableCell>{d.start_shop?.name || "—"}</TableCell>
                      <TableCell>{d.driver?.name || "—"}</TableCell>
                      <TableCell>{d.dispatch_stops?.length || 0}</TableCell>
                      <TableCell>{d.total_distance_km ? `${d.total_distance_km} km` : "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[d.status] || ""}>{d.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
