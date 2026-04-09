import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

// Anonymous voter identity — fetched from server based on IP+UA hash
let cachedVoterHash: string | null = null;

export function useVoter() {
  const { data } = useQuery<{ voterHash: string }>({
    queryKey: ["/api/voter-hash"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/voter-hash");
      const data = await res.json();
      cachedVoterHash = data.voterHash;
      return data;
    },
    staleTime: Infinity,
  });

  return { voterHash: data?.voterHash || cachedVoterHash };
}

type VoteState = "up" | "down" | null;
type AnonVoteRow = { build_id: number; vote_type: string };
type UserVoteRow = { buildId: number; voteType: string };

/**
 * useVotes — manages vote state and mutations for all builds.
 * Supports both logged-in users and anonymous voting.
 */
export function useVotes(invalidateKeys?: any[][]) {
  const { user, isLoggedIn } = useAuth();
  const { voterHash } = useVoter();

  // Fetch anon votes
  const { data: anonVotes } = useQuery<AnonVoteRow[]>({
    queryKey: ["/api/anon-votes", voterHash],
    queryFn: async () => {
      if (!voterHash) return [];
      const res = await apiRequest("GET", `/api/anon-votes/${voterHash}`);
      return res.json();
    },
    enabled: !!voterHash && !isLoggedIn,
    staleTime: 30_000,
  });

  // Fetch user votes if logged in
  const { data: userVotes } = useQuery<UserVoteRow[]>({
    queryKey: ["/api/votes/user", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/votes/user/${user!.id}`);
      return res.json();
    },
    enabled: isLoggedIn && !!user,
    staleTime: 30_000,
  });

  function getVoteState(buildId: number): VoteState {
    if (isLoggedIn && userVotes) {
      const v = userVotes.find(v => v.buildId === buildId);
      return (v?.voteType as VoteState) ?? null;
    }
    if (!isLoggedIn && anonVotes) {
      const v = anonVotes.find(v => v.build_id === buildId);
      return (v?.vote_type as VoteState) ?? null;
    }
    return null;
  }

  const voteMutation = useMutation({
    mutationFn: async ({ buildId, voteType }: { buildId: number; voteType: "up" | "down" }) => {
      if (isLoggedIn && user) {
        const res = await apiRequest("POST", `/api/builds/${buildId}/vote`, { userId: user.id, voteType });
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/builds/${buildId}/anon-vote`, { voteType });
        return res.json();
      }
    },
    onSuccess: (_data, { buildId }) => {
      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ["/api/builds", buildId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tier-list"] });
      // Refresh vote state
      if (isLoggedIn) {
        queryClient.invalidateQueries({ queryKey: ["/api/votes/user", user?.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/anon-votes", voterHash] });
      }
      // Any extra keys the caller wants to invalidate
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
  });

  function castVote(buildId: number, voteType: "up" | "down") {
    voteMutation.mutate({ buildId, voteType });
  }

  return {
    getVoteState,
    castVote,
    isPending: voteMutation.isPending,
    voterHash,
  };
}
