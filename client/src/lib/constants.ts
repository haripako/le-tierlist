export const CLASSES = [
  { id: "sentinel", name: "Sentinel", color: "#d4a537", masteries: ["Void Knight", "Forge Guard", "Paladin"] },
  { id: "mage", name: "Mage", color: "#5b8dd9", masteries: ["Sorcerer", "Spellblade", "Runemaster"] },
  { id: "primalist", name: "Primalist", color: "#4dab6d", masteries: ["Beastmaster", "Shaman", "Druid"] },
  { id: "rogue", name: "Rogue", color: "#9b59b6", masteries: ["Bladedancer", "Marksman", "Falconer"] },
  { id: "acolyte", name: "Acolyte", color: "#c0392b", masteries: ["Necromancer", "Lich", "Warlock"] },
] as const;

export const GAME_MODES = [
  { id: "softcore", name: "Softcore", icon: "⚔️" },
  { id: "hardcore", name: "Hardcore", icon: "💀" },
] as const;

export const PLAYSTYLES = [
  { id: "melee", name: "Melee", icon: "🗡️" },
  { id: "ranged", name: "Ranged", icon: "🏹" },
  { id: "caster", name: "Caster", icon: "✨" },
  { id: "summoner", name: "Summoner", icon: "👻" },
  { id: "hybrid", name: "Hybrid", icon: "⚡" },
] as const;

export const SOURCE_CONFIG: Record<string, { name: string; icon: string; color: string }> = {
  lastepochtools: { name: "LE Tools", icon: "🔧", color: "text-yellow-400" },
  maxroll: { name: "Maxroll", icon: "📊", color: "text-blue-400" },
  youtube: { name: "YouTube", icon: "▶️", color: "text-red-400" },
  youtube_short: { name: "YouTube", icon: "▶️", color: "text-red-400" },
  mobalytics: { name: "Mobalytics", icon: "📈", color: "text-green-400" },
  reddit: { name: "Reddit", icon: "💬", color: "text-orange-400" },
  other: { name: "Link", icon: "🔗", color: "text-muted-foreground" },
};

export const TIER_CONFIG = {
  S: { label: "S", color: "bg-tier-s/20 border-tier-s/40 text-tier-s", bgAccent: "bg-tier-s", textColor: "text-tier-s", description: "Meta-defining" },
  A: { label: "A", color: "bg-tier-a/20 border-tier-a/40 text-tier-a", bgAccent: "bg-tier-a", textColor: "text-tier-a", description: "Excellent" },
  B: { label: "B", color: "bg-tier-b/20 border-tier-b/40 text-tier-b", bgAccent: "bg-tier-b", textColor: "text-tier-b", description: "Good" },
  C: { label: "C", color: "bg-tier-c/20 border-tier-c/40 text-tier-c", bgAccent: "bg-tier-c", textColor: "text-tier-c", description: "Average" },
  D: { label: "D", color: "bg-tier-d/20 border-tier-d/40 text-tier-d", bgAccent: "bg-tier-d", textColor: "text-tier-d", description: "Below Average" },
} as const;

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
