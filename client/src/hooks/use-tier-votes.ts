import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useVoter } from "@/hooks/use-votes";

type TierVoteRow = { buildId: number; tierVote: string };

/**
 * useTierVotes — manages tier vote state and mutations for all builds.
 * Supports both logged-in users and anonymous voting.
 */
export function useTierVotes(invalidateKeys?: any[][]) {
  const { user, isLoggedIn } = useAuth();
  const { voterHash } = useVoter();

  // Fetch all my tier votes
  const { data: myVotes } = useQuery<TierVoteRow[]>({
    queryKey: ["/api/my-tier-votes", isLoggedIn ? user?.id : voterHash],
    queryFn: async () => {
      const params = isLoggedIn && user ? `?userId=${user.id}` : "";
      const res = await apiRequest("GET", `/api/my-tier-votes${params}`);
      return res.json();
    },
    enabled: isLoggedIn ? !!user : !!voterHash,
    staleTime: 30_000,
  });

  function getMyVote(buildId: number): string | null {
    if (!myVotes) return null;
    const v = myVotes.find(v => v.buildId === buildId);
    return v?.tierVote ?? null;
  }

  const voteMutation = useMutation({
    mutationFn: async ({ buildId, tierVote }: { buildId: number; tierVote: string }) => {
      const body: any = { tierVote };
      if (isLoggedIn && user) body.userId = user.id;
      const res = await apiRequest("POST", `/api/builds/${buildId}/tier-vote`, body);
      return res.json();
    },
    onSuccess: (_data, { buildId }) => {
      // Invalidate build
      queryClient.invalidateQueries({ queryKey: ["/api/builds", buildId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tier-list"] });
      queryClient.invalidateQueries({ queryKey: [`/api/builds/${buildId}/vote-distribution`] });
      // Refresh my votes
      queryClient.invalidateQueries({
        queryKey: ["/api/my-tier-votes", isLoggedIn ? user?.id : voterHash],
      });
      // Any extra keys the caller wants to invalidate
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });

  function castVote(buildId: number, tierVote: string) {
    voteMutation.mutate({ buildId, tierVote });
  }

  return {
    getMyVote,
    castVote,
    isPending: voteMutation.isPending,
    voterHash,
  };
}
