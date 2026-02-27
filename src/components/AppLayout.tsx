import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

interface Props {
  title?: string;
}

export default function AppLayout({ title = "Dashboard" }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-60 flex min-h-screen flex-col">
        <TopBar title={title} />
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-[1280px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
