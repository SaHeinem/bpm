import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ActivityLog } from "@/components/activity-log";

export const Route = createFileRoute("/activity")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <DashboardLayout>
      <ActivityLog />
    </DashboardLayout>
  );
}
