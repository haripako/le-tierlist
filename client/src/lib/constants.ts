export const CLASSES = [
  { id: "sentinel", name: "Sentinel", color: "#d4a537", masteries: ["Void Knight", "Forge Guard", "Paladin"] },
  { id: "mage", name: "Mage", color: "#5b8dd9", masteries: ["Sorcerer", "Spellblade", "Runemaster"] },
  { id: "primalist", name: "Primalist", color: "#4dab6d", masteries: ["Beastmaster", "Shaman", "Druid"] },
  { id: "rogue", name: "Rogue", color: "#9b59b6", masteries: ["Bladedancer", "Marksman", "Falconer"] },
  { id: "acolyte", name: "Acolyte", color: "#c0392b", masteries: ["Necromancer", "Lich", "Warlock"] },
] as const;

export const SEASONS = [
  { id: "s4", name: "S4 - Shattered Omens", patch: "1.4" },
  { id: "s3", name: "S3 - Beneath Ancient Skies", patch: "1.3" },
  { id: "s2", name: "S2 - Tombs of the Erased", patch: "1.2" },
  { id: "s1", name: "S1 - Harbingers of Ruin", patch: "1.1" },
  { id: "release", name: "Release (1.0)", patch: "1.0" },
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

export const TIER_CONFIG = {
  S: { label: "S", color: "bg-tier-s/20 border-tier-s/40 text-tier-s", bgAccent: "bg-tier-s", description: "Meta-defining" },
  A: { label: "A", color: "bg-tier-a/20 border-tier-a/40 text-tier-a", bgAccent: "bg-tier-a", description: "Excellent" },
  B: { label: "B", color: "bg-tier-b/20 border-tier-b/40 text-tier-b", bgAccent: "bg-tier-b", description: "Good" },
  C: { label: "C", color: "bg-tier-c/20 border-tier-c/40 text-tier-c", bgAccent: "bg-tier-c", description: "Average" },
  D: { label: "D", color: "bg-tier-d/20 border-tier-d/40 text-tier-d", bgAccent: "bg-tier-d", description: "Below Average" },
} as const;

export function getClassColor(className: string): string {
  return CLASSES.find(c => c.id === className)?.color ?? "#888";
}

export function getClassByMastery(mastery: string) {
  return CLASSES.find(c => c.masteries.includes(mastery as any));
}
