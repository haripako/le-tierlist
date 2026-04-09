import { useState } from "react";

// Generate a persistent voter ID using a random string stored in React state
// Since localStorage is blocked in sandboxed iframes, we use a session-level ID
let globalVoterId: string | null = null;

function generateId(): string {
  return 'voter_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function useVoterId(): string {
  const [voterId] = useState(() => {
    if (!globalVoterId) {
      globalVoterId = generateId();
    }
    return globalVoterId;
  });
  return voterId;
}
