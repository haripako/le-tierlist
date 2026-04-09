// ─── Types ──────────────────────────────────────────────────────

export interface ExtractedBuild {
  name: string;
  className: string;
  mastery: string;
  playstyle: string;
  description: string;
  mainSkills: string[];
  sourceType: string;
  confidence: "high" | "medium" | "low";
  pros: string[];
  cons: string[];
  engagementText: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  budgetLevel: "budget" | "mid-range" | "expensive" | "endgame";
}

// ─── Static LE class/mastery lookup (for URL extraction heuristics) ─
// These are only used by the extract heuristic — the actual classes come from the DB.
const LE_CLASSES = [
  { id: "sentinel", name: "Sentinel", masteries: ["Void Knight", "Forge Guard", "Paladin"] },
  { id: "mage", name: "Mage", masteries: ["Sorcerer", "Spellblade", "Runemaster"] },
  { id: "primalist", name: "Primalist", masteries: ["Beastmaster", "Shaman", "Druid"] },
  { id: "rogue", name: "Rogue", masteries: ["Bladedancer", "Marksman", "Falconer"] },
  { id: "acolyte", name: "Acolyte", masteries: ["Necromancer", "Lich", "Warlock"] },
] as const;

const MASTERY_TO_CLASS: Record<string, string> = {};
const ALL_MASTERIES: string[] = [];
for (const cls of LE_CLASSES) {
  for (const m of cls.masteries) {
    MASTERY_TO_CLASS[m.toLowerCase()] = cls.id;
    ALL_MASTERIES.push(m);
  }
}
const CLASS_NAMES = LE_CLASSES.map(c => c.name.toLowerCase());

// Common LE skill names for matching
const KNOWN_SKILLS = [
  // Sentinel
  "Smite", "Hammer Throw", "Holy Aura", "Lunge", "Sigils of Hope", "Judgement",
  "Vengeance", "Rive", "Forge Strike", "Ring of Shields", "Manifest Armor", "Shield Rush",
  "Void Cleave", "Anomaly", "Devouring Orb", "Rebuke", "Javelin", "Warpath",
  "Volatile Reversal", "Erasing Strike", "Multistrike",
  // Mage
  "Meteor", "Flame Ward", "Teleport", "Focus", "Frost Wall", "Lightning Blast",
  "Runic Invocation", "Frost Claw", "Mana Strike", "Surge", "Enchant Weapon",
  "Firebrand", "Glacier", "Disintegrate", "Static Orb", "Flame Rush", "Snap Freeze",
  "Elemental Nova", "Black Hole", "Flame Reave",
  // Primalist
  "Maelstrom", "Gathering Storm", "Tornado", "Tempest Strike", "Fury Leap",
  "Summon Wolf", "Swipe", "Warcry", "Summon Raptor", "Werebear Form", "Earthquake",
  "Entangling Roots", "Spriggan Form", "Summon Spriggan", "Upheaval", "Avalanche",
  "Summon Bear", "Rampage", "Storm Bolt",
  // Rogue
  "Shadow Cascade", "Dancing Strikes", "Shift", "Smoke Bomb", "Lethal Mirage",
  "Shurikens", "Puncture", "Dark Quiver", "Multishot", "Detonating Arrow",
  "Falconry", "Dive Bomb", "Aerial Assault", "Net", "Hail of Arrows", "Flurry",
  "Acid Flask", "Synchronized Strike", "Umbral Blades", "Cinder Strike",
  "Heartseeker",
  // Acolyte
  "Summon Skeleton", "Summon Wraith", "Dread Shade", "Transplant", "Bone Curse",
  "Death Seal", "Harvest", "Aura of Decay", "Reaper Form", "Spirit Plague",
  "Chaos Bolts", "Profane Veil", "Chthonic Fissure", "Infernal Shade",
  "Hungering Souls", "Rip Blood", "Wandering Spirits", "Volatile Zombies",
  "Marrow Shards", "Drain Life", "Soul Feast",
];

// Playstyle keywords
const PLAYSTYLE_KEYWORDS: Record<string, string[]> = {
  melee: ["melee", "strike", "slash", "cleave", "warpath", "rive", "forge", "swipe", "lunge"],
  ranged: ["ranged", "bow", "archer", "marksman", "arrow", "multishot", "javelin", "heartseeker", "hail of arrows"],
  caster: ["caster", "spell", "cast", "lightning", "fire", "cold", "meteor", "blast", "runic", "sorcerer"],
  summoner: ["summon", "minion", "skeleton", "wraith", "wolf", "companion", "zombie", "necro"],
  hybrid: ["hybrid", "spellblade"],
};

// ─── URL Parsers ────────────────────────────────────────────────

function parseMaxrollUrl(url: string): Partial<ExtractedBuild> {
  // Pattern: maxroll.gg/last-epoch/build-guides/{skill}-{mastery}-guide
  const match = url.match(/build-guides\/(.+?)(?:-build)?-guide/);
  if (!match) return {};

  const slug = match[1]; // e.g., "heartseeker-marksman" or "flame-reave-spellblade"
  const parts = slug.split("-");

  // Try to find mastery from the end of the slug
  for (let i = parts.length - 1; i >= 0; i--) {
    // Try single word mastery
    const candidate = parts[i];
    if (MASTERY_TO_CLASS[candidate]) {
      const skillParts = parts.slice(0, i);
      const skillName = skillParts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return {
        mastery: ALL_MASTERIES.find(m => m.toLowerCase() === candidate) || candidate,
        className: MASTERY_TO_CLASS[candidate],
        name: `${skillName} ${ALL_MASTERIES.find(m => m.toLowerCase() === candidate) || candidate}`,
        mainSkills: skillName ? [skillName] : [],
      };
    }
    // Try two-word mastery (e.g., "void-knight", "forge-guard")
    if (i > 0) {
      const twoWord = `${parts[i - 1]} ${parts[i]}`;
      if (MASTERY_TO_CLASS[twoWord]) {
        const skillParts = parts.slice(0, i - 1);
        const skillName = skillParts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const masteryName = ALL_MASTERIES.find(m => m.toLowerCase() === twoWord) || twoWord;
        return {
          mastery: masteryName,
          className: MASTERY_TO_CLASS[twoWord],
          name: `${skillName} ${masteryName}`,
          mainSkills: skillName ? [skillName] : [],
        };
      }
    }
  }
  return {};
}

function parseTitleForBuildInfo(title: string): Partial<ExtractedBuild> {
  const result: Partial<ExtractedBuild> = {};
  const titleLower = title.toLowerCase();

  // Find mastery
  for (const mastery of ALL_MASTERIES) {
    if (titleLower.includes(mastery.toLowerCase())) {
      result.mastery = mastery;
      result.className = MASTERY_TO_CLASS[mastery.toLowerCase()];
      break;
    }
  }

  // If no mastery found, try base class
  if (!result.mastery) {
    for (const cls of CLASSES) {
      if (titleLower.includes(cls.name.toLowerCase())) {
        result.className = cls.id;
        break;
      }
    }
  }

  // Find skills mentioned in title
  const foundSkills: string[] = [];
  for (const skill of KNOWN_SKILLS) {
    if (titleLower.includes(skill.toLowerCase())) {
      foundSkills.push(skill);
    }
  }
  if (foundSkills.length > 0) {
    result.mainSkills = foundSkills;
  }

  // Try to extract a clean build name from title
  // Remove common suffixes like "Build Guide", "Last Epoch", season info, etc.
  let cleanName = title
    .replace(/\s*[\|–—-]\s*last\s*epoch.*/i, "")
    .replace(/\s*[\|–—-]\s*maxroll.*/i, "")
    .replace(/\s*[\|–—-]\s*mobalytics.*/i, "")
    .replace(/\bfor\s+last\s+epoch\b.*/i, "")
    .replace(/\blast\s+epoch\b/gi, "")
    .replace(/\bbuild\s*guide\b/gi, "")
    .replace(/\bguide\b/gi, "")
    .replace(/\bseason\s*\d+\b/gi, "")
    .replace(/\b1\.\d+\b/g, "")
    .replace(/\b\d{3,4}\+?\s*corruption\b/gi, "")
    .replace(/\b[sS]\+?\s*tier\b/gi, "")
    .replace(/\btier\s*list\b/gi, "")
    .replace(/\bzero\s*to\s*hero\b/gi, "")
    .replace(/\bshowcase\b/gi, "")
    .replace(/\bleveling\b/gi, "")
    .replace(/\bendgame\b/gi, "")
    .replace(/[\|–—]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanName.length > 3) {
    result.name = cleanName;
  }

  return result;
}

function detectPlaystyle(title: string, skills: string[]): string {
  const text = `${title} ${skills.join(" ")}`.toLowerCase();
  let bestMatch = "melee";
  let bestCount = 0;

  for (const [style, keywords] of Object.entries(PLAYSTYLE_KEYWORDS)) {
    const count = keywords.filter(k => text.includes(k)).length;
    if (count > bestCount) {
      bestCount = count;
      bestMatch = style;
    }
  }
  return bestMatch;
}

// ─── Main extraction ────────────────────────────────────────────

export async function extractBuildFromUrl(url: string): Promise<ExtractedBuild> {
  const hostname = new URL(url).hostname.replace("www.", "");
  let sourceType = "other";
  if (hostname.includes("lastepochtools.com")) sourceType = "lastepochtools";
  else if (hostname.includes("maxroll.gg")) sourceType = "maxroll";
  else if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) sourceType = "youtube";
  else if (hostname.includes("mobalytics.gg")) sourceType = "mobalytics";
  else if (hostname.includes("reddit.com")) sourceType = "reddit";
  else if (hostname.includes("icy-veins.com")) sourceType = "icy-veins";
  else if (hostname.includes("fextralife.com")) sourceType = "fextralife";
  else if (hostname.includes("game8.co")) sourceType = "game8";
  else if (hostname.includes("poe.ninja")) sourceType = "poe-ninja";
  else if (hostname.includes("poebuilds.net")) sourceType = "poebuilds";
  else if (hostname.includes("poewiki.net")) sourceType = "poewiki";
  else if (hostname.includes("builds.gg")) sourceType = "builds-gg";
  else if (hostname.includes("hacktheminotaur.com")) sourceType = "hacktheminotaur";

  // Start with URL-based parsing (Maxroll has structured URLs)
  let urlParsed: Partial<ExtractedBuild> = {};
  if (sourceType === "maxroll") {
    urlParsed = parseMaxrollUrl(url);
  }

  // Fetch page to get title and meta tags
  let pageTitle = "";
  let pageDescription = "";
  let ogTitle = "";
  let ogDescription = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BuildBot/1.0)",
        "Accept": "text/html",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();

      // Extract <title>
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) pageTitle = titleMatch[1].trim();

      // Extract og:title
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
        || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:title"/i);
      if (ogTitleMatch) ogTitle = ogTitleMatch[1].trim();

      // Extract og:description or meta description
      const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
        || html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i);
      if (ogDescMatch) ogDescription = ogDescMatch[1].trim();

      const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
        || html.match(/<meta[^>]*content="([^"]+)"[^>]*name="description"/i);
      if (descMatch) pageDescription = descMatch[1].trim();
    }
  } catch {
    // Fetch failed — we'll work with URL-only data
  }

  // For YouTube, try oEmbed API for clean title
  if (sourceType === "youtube" && !ogTitle) {
    try {
      const videoId = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
      if (videoId) {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
          const data = await oembedRes.json();
          ogTitle = data.title || "";
        }
      }
    } catch {}
  }

  // Best title to parse
  const bestTitle = ogTitle || pageTitle || "";
  const titleParsed = parseTitleForBuildInfo(bestTitle);

  // Merge: URL data takes priority, then title data
  const name = urlParsed.name || titleParsed.name || bestTitle.slice(0, 80) || "Unnamed Build";
  const mastery = urlParsed.mastery || titleParsed.mastery || "";
  const className = urlParsed.className || titleParsed.className || "";
  const mainSkills = urlParsed.mainSkills || titleParsed.mainSkills || [];
  const description = ogDescription || pageDescription || "";
  const playstyle = detectPlaystyle(bestTitle, mainSkills);

  // Confidence level
  let confidence: "high" | "medium" | "low" = "low";
  if (mastery && className && mainSkills.length > 0) confidence = "high";
  else if (mastery || className) confidence = "medium";

  // Decode HTML entities in description
  const cleanDescription = description
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .slice(0, 500);

  // ─── Infer difficulty from text ───────────────────────────────
  const fullText = `${bestTitle} ${cleanDescription}`.toLowerCase();
  let difficulty: "beginner" | "intermediate" | "advanced" | "expert" = "intermediate";
  if (/\b(beginner|starter|leveling|league starter|fresh|budget|easy|new player)\b/.test(fullText)) {
    difficulty = "beginner";
  } else if (/\b(endgame|push|1000\+?\s*corruption|pit 100|greater rift|expert|pinnacle|t4|high push)\b/.test(fullText)) {
    difficulty = "expert";
  } else if (/\b(advanced|complex|hard|optimize|bossing|end-game)\b/.test(fullText)) {
    difficulty = "advanced";
  }

  // ─── Infer budget level from text ─────────────────────────────
  let budgetLevel: "budget" | "mid-range" | "expensive" | "endgame" = "mid-range";
  if (/\b(budget|cheap|starter|ssf|no currency|free|trade league|league start)\b/.test(fullText)) {
    budgetLevel = "budget";
  } else if (/\b(mirror|bis|best-in-slot|godroll|mirror-tier|headhunter|mageblood|chase unique|expensive endgame)\b/.test(fullText)) {
    budgetLevel = "endgame";
  } else if (/\b(expensive|investment|pricey|high cost|bis items|chase item)\b/.test(fullText)) {
    budgetLevel = "expensive";
  }

  // ─── Generate generic pros/cons from playstyle ───────────────
  const prosMap: Record<string, string[]> = {
    melee: ["High sustained melee DPS", "Good tankiness from close range", "Strong AoE clear"],
    ranged: ["Safe ranged playstyle", "Excellent kiting potential", "Good damage from range"],
    caster: ["Excellent AoE spell coverage", "Strong crowd control", "High damage ceiling"],
    summoner: ["Minions tank for you", "Very safe playstyle", "Strong passive damage"],
    hybrid: ["Versatile damage types", "Flexible playstyle", "Good in all situations"],
  };
  const consMap: Record<string, string[]> = {
    melee: ["Must be in melee range", "Vulnerable to ranged attacks"],
    ranged: ["Lower damage in close range", "Movement intensive"],
    caster: ["Can be squishy", "Mana/resource management"],
    summoner: ["Minion management overhead", "Minions can die"],
    hybrid: ["Complex gear requirements", "Higher skill floor"],
  };
  const pros = prosMap[playstyle] || prosMap.melee;
  const cons = consMap[playstyle] || consMap.melee;

  // ─── Generate engagement text from name + description ─────────
  const engagementText = cleanDescription
    ? `${cleanDescription.slice(0, 150).trim()} — check the full guide to see if this build fits your playstyle.`
    : `${name} is a ${playstyle} build worth exploring. Read the full guide to understand its strengths.`;

  return {
    name,
    className,
    mastery,
    playstyle,
    description: cleanDescription,
    mainSkills,
    sourceType,
    confidence,
    pros,
    cons,
    engagementText,
    difficulty,
    budgetLevel,
  };
}
