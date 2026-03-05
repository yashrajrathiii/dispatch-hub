import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Unauthorized from "@/pages/Unauthorized";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import PriceList from "@/pages/PriceList";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import PlaceholderPage from "@/pages/PlaceholderPage";
import SettingsShops from "@/pages/SettingsShops";
import SettingsBrands from "@/pages/SettingsBrands";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            <Route element={<ProtectedRoute><AppLayout title="Dashboard" /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN", "STAFF"]}><AppLayout title="Inventory" /></ProtectedRoute>}>
              <Route path="/inventory" element={<Inventory />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}><AppLayout title="Price List" /></ProtectedRoute>}>
              <Route path="/price-list" element={<PriceList />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN", "STAFF"]}><AppLayout title="Orders" /></ProtectedRoute>}>
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN", "STAFF"]}><AppLayout title="Walk-in Purchase" /></ProtectedRoute>}>
              <Route path="/walk-in" element={<PlaceholderPage title="Walk-in Purchase" />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN", "STAFF", "DRIVER"]}><AppLayout title="Dispatch" /></ProtectedRoute>}>
              <Route path="/dispatch" element={<PlaceholderPage title="Dispatch" />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN", "STAFF"]}><AppLayout title="Buyers" /></ProtectedRoute>}>
              <Route path="/buyers" element={<PlaceholderPage title="Buyers" />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}><AppLayout title="Settings" /></ProtectedRoute>}>
              <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
              <Route path="/settings/shops" element={<SettingsShops />} />
              <Route path="/settings/brands" element={<SettingsBrands />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
