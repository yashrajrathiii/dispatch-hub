import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

interface Props {
  title?: string;
}

export default function AppLayout({ title = "Dashboard" }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isSettingsSubPage =
    location.pathname.startsWith("/settings/") && location.pathname !== "/settings";

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Backdrop for mobile when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:ml-60 ml-0 flex min-h-screen flex-col">
        <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-[1280px]">
            {isSettingsSubPage && (
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="mb-4 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Settings</span>
              </button>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
