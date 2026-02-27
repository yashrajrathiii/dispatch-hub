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
import PlaceholderPage from "@/pages/PlaceholderPage";
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

            <Route element={<ProtectedRoute allowedRoles={["owner", "admin", "staff"]}><AppLayout title="Inventory" /></ProtectedRoute>}>
              <Route path="/inventory" element={<Inventory />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["owner", "admin", "staff"]}><AppLayout title="Price List" /></ProtectedRoute>}>
              <Route path="/price-list" element={<PlaceholderPage title="Price List" />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["owner", "admin", "staff"]}><AppLayout title="Orders" /></ProtectedRoute>}>
              <Route path="/orders" element={<PlaceholderPage title="Orders" />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["owner", "admin", "staff"]}><AppLayout title="Walk-in Purchase" /></ProtectedRoute>}>
              <Route path="/walk-in" element={<PlaceholderPage title="Walk-in Purchase" />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["owner", "admin", "staff", "driver"]}><AppLayout title="Dispatch" /></ProtectedRoute>}>
              <Route path="/dispatch" element={<PlaceholderPage title="Dispatch" />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["owner", "admin", "staff"]}><AppLayout title="Buyers" /></ProtectedRoute>}>
              <Route path="/buyers" element={<PlaceholderPage title="Buyers" />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["owner", "admin"]}><AppLayout title="Settings" /></ProtectedRoute>}>
              <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
