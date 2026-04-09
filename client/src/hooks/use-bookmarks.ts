import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useVoter } from "@/hooks/use-votes";

type AnonBookmarkRow = { buildId: number; voterHash: string };

/**
 * useBookmarks — manages bookmark state and mutations.
 * Supports both logged-in users and anonymous bookmarking.
 */
export function useBookmarks(invalidateKeys?: any[][]) {
  const { user, isLoggedIn } = useAuth();
  const { voterHash } = useVoter();

  // Fetch anon bookmarks
  const { data: anonBookmarks } = useQuery<AnonBookmarkRow[]>({
    queryKey: ["/api/bookmarks/anon", voterHash],
    queryFn: async () => {
      if (!voterHash) return [];
      const res = await apiRequest("GET", `/api/bookmarks/anon/${voterHash}`);
      return res.json();
    },
    enabled: !!voterHash && !isLoggedIn,
    staleTime: 30_000,
  });

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
    if (!isLoggedIn && anonBookmarks) {
      return anonBookmarks.some((b: any) => (b.build_id || b.buildId) === buildId);
    }
    return false;
  }

  const bookmarkMutation = useMutation({
    mutationFn: async ({ buildId }: { buildId: number }) => {
      if (isLoggedIn && user) {
        const res = await apiRequest("POST", `/api/builds/${buildId}/bookmark`, { userId: user.id });
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/builds/${buildId}/anon-bookmark`, {});
        return res.json();
      }
    },
    onSuccess: (_data, { buildId }) => {
      if (isLoggedIn) {
        queryClient.invalidateQueries({ queryKey: ["/api/bookmarks/user", user?.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/bookmarks/anon", voterHash] });
      }
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
    anonBookmarks: anonBookmarks ?? [],
  };
}
