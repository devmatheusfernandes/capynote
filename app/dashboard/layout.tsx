import RouteAwareFloatingCreateButton from "@/components/route-aware-floating-create-button";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import MountNotifications from "@/components/mount-notifications";
import { ProtectedRoute } from "@/components/protected-route";
import AutoBackup from "@/components/auto-backup";

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
        <AutoBackup />
        <RouteAwareFloatingCreateButton />
      </DashboardSidebar>
    </ProtectedRoute>
  );
}
