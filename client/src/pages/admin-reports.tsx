import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Flag, Trash2, X, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ReportWithMeta = {
  id: number;
  buildId: number;
  voterHash: string;
  reason: string;
  createdAt: string;
  build_name?: string;
  game_name?: string;
};

export default function AdminReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: reports, isLoading } = useQuery<ReportWithMeta[]>({
    queryKey: ["/api/admin/reports", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/reports?adminUserId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const dismissMutation = useMutation({
    mutationFn: async (reportId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/reports/${reportId}`, { adminUserId: user?.id });
      if (!res.ok) throw new Error("Failed to dismiss");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports", user?.id] });
      toast({ title: "Report dismissed" });
    },
    onError: () => toast({ title: "Failed to dismiss report", variant: "destructive" }),
  });

  const deleteBuildMutation = useMutation({
    mutationFn: async ({ reportId, buildId }: { reportId: number; buildId: number }) => {
      // Delete the build
      await apiRequest("DELETE", `/api/admin/builds/${buildId}`, { adminUserId: user?.id });
      // Then dismiss the report
      await apiRequest("DELETE", `/api/admin/reports/${reportId}`, { adminUserId: user?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/builds", user?.id] });
      toast({ title: "Build deleted and report dismissed" });
    },
    onError: () => toast({ title: "Failed to delete build", variant: "destructive" }),
  });

  return (
    <AdminLayout title="Reports">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-red-400" />
          <p className="text-sm text-muted-foreground">
            {reports?.length ?? 0} report{reports?.length !== 1 ? "s" : ""} pending review
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !reports?.length ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-no-reports">
            <Flag className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No reports</p>
            <p className="text-sm mt-1">The community is behaving well.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(report => (
              <div
                key={report.id}
                className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card"
                data-testid={`report-row-${report.id}`}
              >
                <Flag className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/build/${report.buildId}`}>
                      <span className="text-sm font-medium hover:text-primary cursor-pointer" data-testid={`link-report-build-${report.id}`}>
                        {report.build_name || `Build #${report.buildId}`}
                      </span>
                    </Link>
                    {report.game_name && (
                      <Badge variant="secondary" className="text-xs">{report.game_name}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reason: <span className="text-foreground">{report.reason}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reporter hash: <span className="font-mono text-[10px]">{report.voterHash.slice(0, 16)}…</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={`/#/build/${report.buildId}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" data-testid={`link-view-build-${report.id}`}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissMutation.mutate(report.id)}
                    disabled={dismissMutation.isPending}
                    data-testid={`button-dismiss-report-${report.id}`}
                    title="Dismiss report"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteBuildMutation.mutate({ reportId: report.id, buildId: report.buildId })}
                    disabled={deleteBuildMutation.isPending}
                    data-testid={`button-delete-build-${report.id}`}
                    title="Delete build"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Build
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
