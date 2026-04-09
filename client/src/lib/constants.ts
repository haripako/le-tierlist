// Playstyles — universal across games
export const PLAYSTYLES = [
  { id: "melee", name: "Melee", icon: "🗡️" },
  { id: "ranged", name: "Ranged", icon: "🏹" },
  { id: "caster", name: "Caster", icon: "✨" },
  { id: "summoner", name: "Summoner", icon: "👻" },
  { id: "hybrid", name: "Hybrid", icon: "⚡" },
] as const;

// Game categories for display
export const GAME_CATEGORIES = [
  { id: "arpg", name: "ARPG" },
  { id: "looter-shooter", name: "Looter-Shooter" },
  { id: "mmo", name: "MMO" },
  { id: "other", name: "Other" },
] as const;

// Source config for build guide links — expanded with new sites
export const SOURCE_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  lastepochtools: { name: "LE Tools", icon: "🔧", color: "text-yellow-400" },
  maxroll: { name: "Maxroll", icon: "📊", color: "text-blue-400" },
  youtube: { name: "YouTube", icon: "▶️", color: "text-red-400" },
  youtube_short: { name: "YouTube", icon: "▶️", color: "text-red-400" },
  mobalytics: { name: "Mobalytics", icon: "📈", color: "text-green-400" },
  reddit: { name: "Reddit", icon: "💬", color: "text-orange-400" },
  "icy-veins": { name: "Icy Veins", icon: "❄️", color: "text-cyan-400" },
  fextralife: { name: "Fextralife", icon: "📖", color: "text-purple-400" },
  game8: { name: "Game8", icon: "🎮", color: "text-indigo-400" },
  "poe-ninja": { name: "PoE Ninja", icon: "🥷", color: "text-yellow-300" },
  poebuilds: { name: "PoE Builds", icon: "🔥", color: "text-orange-300" },
  poewiki: { name: "PoE Wiki", icon: "📚", color: "text-gray-400" },
  "builds-gg": { name: "Builds.gg", icon: "🏗️", color: "text-emerald-400" },
  hacktheminotaur: { name: "HackTheMinotaur", icon: "🐂", color: "text-amber-400" },
  other: { name: "Link", icon: "🔗", color: "text-muted-foreground" },
};

// Client-side source detection helper
export function detectSourceClient(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    if (hostname.includes("lastepochtools.com")) return "lastepochtools";
    if (hostname.includes("maxroll.gg")) return "maxroll";
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("mobalytics.gg")) return "mobalytics";
    if (hostname.includes("reddit.com")) return "reddit";
    if (hostname.includes("icy-veins.com")) return "icy-veins";
    if (hostname.includes("fextralife.com")) return "fextralife";
    if (hostname.includes("game8.co")) return "game8";
    if (hostname.includes("poe.ninja")) return "poe-ninja";
    if (hostname.includes("poebuilds.net")) return "poebuilds";
    if (hostname.includes("poewiki.net")) return "poewiki";
    if (hostname.includes("builds.gg")) return "builds-gg";
    if (hostname.includes("hacktheminotaur.com")) return "hacktheminotaur";
    return "other";
  } catch { return "other"; }
}

// Tier config — drives both build card styling and tier row styling
export const TIER_CONFIG = {
  "S+": { label: "S+", color: "bg-yellow-400/20 border-yellow-400/50 text-yellow-300", bgAccent: "bg-yellow-400", textColor: "text-yellow-300", description: "Absolute Best" },
  S: { label: "S", color: "bg-tier-s/20 border-tier-s/40 text-tier-s", bgAccent: "bg-tier-s", textColor: "text-tier-s", description: "Meta-defining" },
  A: { label: "A", color: "bg-tier-a/20 border-tier-a/40 text-tier-a", bgAccent: "bg-tier-a", textColor: "text-tier-a", description: "Excellent" },
  B: { label: "B", color: "bg-tier-b/20 border-tier-b/40 text-tier-b", bgAccent: "bg-tier-b", textColor: "text-tier-b", description: "Good" },
  C: { label: "C", color: "bg-tier-c/20 border-tier-c/40 text-tier-c", bgAccent: "bg-tier-c", textColor: "text-tier-c", description: "Average" },
  D: { label: "D", color: "bg-tier-d/20 border-tier-d/40 text-tier-d", bgAccent: "bg-tier-d", textColor: "text-tier-d", description: "Below Average" },
  N: { label: "N", color: "border-gray-500/30 bg-gray-500/5", bgAccent: "bg-gray-500", textColor: "text-gray-400", description: "Not Yet Rated" },
} as const;

// Tier vote button styles
export const TIER_VOTE_CONFIG: Record<string, { bg: string; activeBg: string; text: string; activeText: string; border: string; activeBorder: string }> = {
  "S+": {
    bg: "bg-yellow-400/10 hover:bg-yellow-400/20",
    activeBg: "bg-yellow-400/30",
    text: "text-yellow-400/70",
    activeText: "text-yellow-300",
    border: "border-yellow-400/30",
    activeBorder: "border-yellow-400/80",
  },
  S: {
    bg: "bg-amber-400/10 hover:bg-amber-400/20",
    activeBg: "bg-amber-400/30",
    text: "text-amber-400/70",
    activeText: "text-amber-300",
    border: "border-amber-400/30",
    activeBorder: "border-amber-400/80",
  },
  A: {
    bg: "bg-orange-400/10 hover:bg-orange-400/20",
    activeBg: "bg-orange-400/30",
    text: "text-orange-400/70",
    activeText: "text-orange-300",
    border: "border-orange-400/30",
    activeBorder: "border-orange-400/80",
  },
  B: {
    bg: "bg-purple-400/10 hover:bg-purple-400/20",
    activeBg: "bg-purple-400/30",
    text: "text-purple-400/70",
    activeText: "text-purple-300",
    border: "border-purple-400/30",
    activeBorder: "border-purple-400/80",
  },
  C: {
    bg: "bg-blue-400/10 hover:bg-blue-400/20",
    activeBg: "bg-blue-400/30",
    text: "text-blue-400/70",
    activeText: "text-blue-300",
    border: "border-blue-400/30",
    activeBorder: "border-blue-400/80",
  },
  D: {
    bg: "bg-gray-400/10 hover:bg-gray-400/20",
    activeBg: "bg-gray-400/30",
    text: "text-gray-400/70",
    activeText: "text-gray-300",
    border: "border-gray-400/30",
    activeBorder: "border-gray-400/60",
  },
};

// Karma color helper
export function getKarmaColor(karma: number): string {
  if (karma >= 1000) return "text-tier-s";
  if (karma >= 500) return "text-tier-a";
  if (karma >= 200) return "text-tier-b";
  if (karma >= 50) return "text-tier-c";
  return "text-muted-foreground";
}

export function getKarmaTitle(karma: number): string {
  if (karma >= 1000) return "Legendary";
  if (karma >= 500) return "Expert";
  if (karma >= 200) return "Trusted";
  if (karma >= 50) return "Regular";
  if (karma >= 0) return "Newcomer";
  return "Controversial";
}

// Category display name helper
export function getCategoryLabel(category: string): string {
  const found = GAME_CATEGORIES.find(c => c.id === category);
  return found?.name ?? category.toUpperCase();
}
