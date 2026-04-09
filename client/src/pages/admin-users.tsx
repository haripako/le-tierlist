import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import AdminLayout from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { getKarmaColor, getKarmaTitle } from "@/lib/constants";
import type { User } from "@shared/schema";

export default function AdminUsersPage() {
  const { user } = useAuth();

  const { data: allUsers, isLoading } = useQuery<Omit<User, "passwordHash">[]>({
    queryKey: ["/api/admin/users", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users?adminUserId=${user?.id}`);
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  return (
    <AdminLayout title="Users">
      <Card data-testid="users-admin-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            All Users ({allUsers?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : (allUsers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <div className="space-y-2">
              {(allUsers ?? []).map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-border" data-testid={`user-row-${u.id}`}>
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">{u.username[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{u.username}</span>
                      {u.isAdmin && <Badge variant="outline" className="text-[10px] text-primary">admin</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className={getKarmaColor(u.karma)}>{u.karma} karma</span>
                      {" · "}{getKarmaTitle(u.karma)}
                      {" · "}{u.buildSubmissions} builds
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">#{u.id}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
