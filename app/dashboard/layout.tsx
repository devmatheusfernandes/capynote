import { FloatingCreateButton } from "@/components/create-button";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import MountNotifications from "@/components/mount-notifications";
import { ProtectedRoute } from "@/components/protected-route";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <DashboardSidebar>
        <div className="bg-background h-full">{children}</div>
        <MountNotifications />
        <FloatingCreateButton />
      </DashboardSidebar>
    </ProtectedRoute>
  );
}
