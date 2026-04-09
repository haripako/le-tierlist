import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

/**
 * useBookmarks — manages bookmark state and mutations.
 * Bookmarks are ONLY available for logged-in users.
 */
export function useBookmarks(invalidateKeys?: any[][]) {
  const { user, isLoggedIn } = useAuth();

  // Fetch user bookmarks if logged in
  const { data: userBookmarks } = useQuery<any[]>({
    queryKey: ["/api/bookmarks/user", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/bookmarks/user/${user!.id}`);
      return res.json();
    },
    enabled: isLoggedIn && !!user,
    staleTime: 30_000,
  });

  function isBookmarked(buildId: number): boolean {
    if (isLoggedIn && userBookmarks) {
      return userBookmarks.some(b => b.id === buildId);
    }
    return false;
  }

  const bookmarkMutation = useMutation({
    mutationFn: async ({ buildId }: { buildId: number }) => {
      if (!isLoggedIn || !user) throw new Error("Must be logged in to bookmark");
      const res = await apiRequest("POST", `/api/builds/${buildId}/bookmark`, { userId: user.id });
      return res.json();
    },
    onSuccess: (_data, { buildId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookmarks/user", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/builds", buildId] });
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });

  function toggleBookmark(buildId: number) {
    bookmarkMutation.mutate({ buildId });
  }

  return {
    isBookmarked,
    toggleBookmark,
    isPending: bookmarkMutation.isPending,
    userBookmarks: userBookmarks ?? [],
  };
}
