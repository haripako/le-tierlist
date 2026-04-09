import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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

  return {
    voterHash: data?.voterHash || cachedVoterHash,
  };
}
