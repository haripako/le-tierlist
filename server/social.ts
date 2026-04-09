import type { BuildWithSubmitter } from "@shared/schema";

// ─── Hook line templates ─────────────────────────────────────────

const HOOK_TEMPLATES = [
  "This {CLASS} build is DESTROYING {TIER} in {GAME} right now 🔥",
  "The community has spoken: {BUILD_NAME} is {TIER_LABEL} tier 🏆",
  "Still sleeping on {BUILD_NAME}? The votes don't lie.",
  "{SCORE}+ upvotes can't be wrong. {BUILD_NAME} is the real deal.",
  "If you're not running {BUILD_NAME} in {GAME}, you're missing out 💀",
  "This {CLASS} build just BROKE {GAME} — {SCORE} votes and climbing",
  "{BUILD_NAME} is the {TIER_LABEL} build you need to try RIGHT NOW",
  "Everyone is playing {BUILD_NAME} and the numbers prove it",
  "Is {BUILD_NAME} the best {CLASS} build in {GAME}? Community says YES",
  "{UPVOTES} players can't be wrong — {BUILD_NAME} GOES CRAZY 🎮",
  "POV: You finally try {BUILD_NAME} and realize it's actually {TIER_LABEL}",
  "Stop ignoring {BUILD_NAME}. {SCORE} community votes say it's elite.",
  "The {GAME} meta just shifted — {BUILD_NAME} is taking over",
  "{BUILD_NAME} reached {TIER_LABEL} tier on BuildTier and it's deserved",
  "Why is no one talking about {BUILD_NAME}? {SCORE} upvotes and counting 🔥",
  "{CLASS} mains — {BUILD_NAME} is the build you've been waiting for",
  "Tested and approved by the community: {BUILD_NAME} is genuinely {TIER_LABEL}",
  "This {TIER_LABEL} {CLASS} build in {GAME} is absolutely disgusting (in a good way)",
  "{GAME} players are obsessed with {BUILD_NAME} right now — for good reason",
  "The top {TIER_LABEL} build in {GAME} right now? {BUILD_NAME}. No contest.",
];

// ─── Tier messaging ─────────────────────────────────────────────

const TIER_MESSAGING: Record<string, { adjective: string; phrase: string; emoji: string }> = {
  "S+": { adjective: "ABSOLUTE BEST", phrase: "literally broken", emoji: "✨" },
  S: { adjective: "META-DEFINING", phrase: "absolutely broken", emoji: "💎" },
  A: { adjective: "EXCELLENT", phrase: "a top pick", emoji: "⭐" },
  B: { adjective: "SOLID CHOICE", phrase: "reliable and strong", emoji: "✅" },
  C: { adjective: "AVERAGE", phrase: "niche but functional", emoji: "⚠️" },
  D: { adjective: "NEEDS BUFFS", phrase: "for the brave", emoji: "🔧" },
  New: { adjective: "FRESH", phrase: "just dropped", emoji: "🆕" },
};

function getTierLabel(tier: string): string {
  switch (tier) {
    case "S+": return "S+-tier";
    case "S": return "S-tier";
    case "A": return "A-tier";
    case "B": return "B-tier";
    case "C": return "C-tier";
    case "D": return "D-tier";
    default: return "New Build";
  }
}

/** Derive tier from the build's calculatedTier field (new system). */
function getTierFromScore(upvotes: number, downvotes: number): string {
  // Legacy fallback — now we use calculatedTier from builds directly
  return "New";
}

function getTierForBuild(build: BuildWithSubmitter): string {
  const ct = (build as any).calculatedTier;
  return ct && ct !== "N" ? ct : "New";
}

// ─── Hook generator ─────────────────────────────────────────────

function generateHook(build: BuildWithSubmitter, gameName: string, tier: string): string {
  const tierLabel = getTierLabel(tier);
  const tierMsg = TIER_MESSAGING[tier] ?? TIER_MESSAGING["New"];
  const voteCount = (build as any).tierVoteCount ?? 0;

  const idx = (build.id ?? 0) % HOOK_TEMPLATES.length;
  const template = HOOK_TEMPLATES[idx];

  return template
    .replace("{CLASS}", build.className || "this")
    .replace("{TIER}", tierMsg.adjective)
    .replace("{GAME}", gameName)
    .replace("{BUILD_NAME}", build.name)
    .replace("{TIER_LABEL}", tierLabel)
    .replace("{SCORE}", voteCount.toString())
    .replace("{UPVOTES}", voteCount.toString());
}

// ─── Hashtag generators ─────────────────────────────────────────

function getGameHashtag(gameName: string): string {
  const map: Record<string, string> = {
    "Last Epoch": "LastEpoch",
    "Diablo IV": "DiabloIV",
    "Diablo 4": "Diablo4",
    "Path of Exile 2": "PathOfExile2",
    "Path of Exile": "PathOfExile",
    "Diablo II Resurrected": "DiabloIIResurrected",
    "Diablo III": "Diablo3",
    "Grim Dawn": "GrimDawn",
    "Torchlight Infinite": "TorchlightInfinite",
    "Destiny 2": "Destiny2",
    "Borderlands 3": "Borderlands3",
    "Borderlands 4": "Borderlands4",
    "Fallout 4": "Fallout4",
    "Crimson Desert": "CrimsonDesert",
  };
  return map[gameName] ?? gameName.replace(/\s+/g, "");
}

function getClassHashtag(className: string): string {
  return className.replace(/\s+/g, "");
}

function generateHashtagsTwitter(build: BuildWithSubmitter, gameName: string, tier: string): string {
  const gameTag = getGameHashtag(gameName);
  const classTag = getClassHashtag(build.className);
  const tierTag = tier === "S" ? "MetaBuild" : tier === "A" ? "TopBuild" : "BuildGuide";
  return `#${gameTag} #${classTag} #${tierTag} #ARPG #BuildTier`;
}

function generateHashtagsInstagram(build: BuildWithSubmitter, gameName: string, tier: string): string {
  const gameTag = getGameHashtag(gameName);
  const classTag = getClassHashtag(build.className);
  const masteryTag = build.mastery ? `#${build.mastery.replace(/\s+/g, "")}` : "";
  const tierTag = tier === "S" ? "STier" : tier === "A" ? "ATier" : "TierList";

  const tags = [
    `#${gameTag}`, `#${classTag}`, masteryTag, `#${tierTag}`,
    "#ARPG", "#ARPGBuilds", "#Gaming", "#GamingCommunity",
    "#BuildGuide", "#TierList", "#MetaBuild", "#OPBuild",
    "#GamingTikTok", "#GamerLife", "#BuildTier", "#VoteNow",
    "#CommunityPick", "#GamersOfInstagram", "#PCGaming",
    "#OnlineGaming", "#RPG", "#ActionRPG", "#GameBuild",
    "#GuildGuide", "#PowerBuild", "#EliteBuild", "#ProGamer",
    "#GameMeta", "#TopBuilds", "#BuildRankings",
  ].filter(Boolean);

  // Ensure exactly 30 tags
  return tags.slice(0, 30).join(" ");
}

function generateHashtagsTikTok(build: BuildWithSubmitter, gameName: string, tier: string): string {
  const gameTag = getGameHashtag(gameName);
  const classTag = getClassHashtag(build.className);
  return `#${gameTag} #${classTag} #ARPG #Gaming #BuildGuide #TierList #fyp #GamingTikTok`;
}

function generateHashtagsYouTube(build: BuildWithSubmitter, gameName: string, tier: string): string {
  const gameTag = getGameHashtag(gameName);
  const classTag = getClassHashtag(build.className);
  const tierTag = tier === "S" ? "MetaBuild" : "BuildGuide";
  return [
    `#${gameTag}`, `#${classTag}`, `#${tierTag}`,
    "#ARPG", "#Gaming", "#BuildGuide", "#TierList",
    "#GamingCommunity", "#GameBuild", "#ProBuild",
    "#BuildTier", "#CommunityRanking", "#ARPGBuilds",
    "#TopBuilds", "#MetaGaming",
  ].join(" ");
}

// ─── Platform content generators ────────────────────────────────

const BUILDTIER_URL = "https://buildtier.gg";

function formatSkills(mainSkills: string): string {
  try {
    const parsed = JSON.parse(mainSkills);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 4).join(", ");
  } catch {}
  return "See guide for full skill tree";
}

function generateTwitterContent(
  build: BuildWithSubmitter,
  gameName: string,
  tier: string,
  hookLine: string,
  hashtags: string,
): string {
  const tierLabel = getTierLabel(tier);
  const voteCount = (build as any).tierVoteCount ?? 0;
  const masteryPart = build.mastery ? ` / ${build.mastery}` : "";

  // Extract top 2 pros
  let prosText = "";
  try {
    const prosArr: string[] = JSON.parse((build as any).pros || "[]");
    if (prosArr.length > 0) {
      prosText = `\n✅ ${prosArr[0]}`;
      if (prosArr.length > 1) prosText += `\n✅ ${prosArr[1]}`;
    }
  } catch {}

  const content = `🏆 ${hookLine}

${build.name} — Rated ${tierLabel} by ${voteCount} players
🎮 ${gameName} | ${build.className}${masteryPart}${prosText}

Vote & see the full tier list: ${BUILDTIER_URL}

${hashtags}`;

  // Twitter: truncate to 280 chars if needed
  if (content.length <= 280) return content;
  const shortHook = hookLine.length > 80 ? hookLine.slice(0, 77) + "..." : hookLine;
  return `🏆 ${shortHook}

${build.name} — ${tierLabel}
🎮 ${gameName} | ${build.className}
Rated by ${voteCount} players — ${BUILDTIER_URL}

${hashtags}`.slice(0, 280);
}

function generateInstagramContent(
  build: BuildWithSubmitter,
  gameName: string,
  tier: string,
  hookLine: string,
  hashtags: string,
): string {
  const tierLabel = getTierLabel(tier);
  const tierMsg = TIER_MESSAGING[tier] ?? TIER_MESSAGING["New"];
  const masteryPart = build.mastery ? ` / ${build.mastery}` : "";
  const skills = formatSkills(build.mainSkills);
  const descShort = build.description
    ? build.description.slice(0, 120) + (build.description.length > 120 ? "..." : "")
    : `A ${tierMsg.adjective.toLowerCase()} ${build.className} build for ${gameName}.`;

  // Build pros/cons section
  let prosConsText = "";
  try {
    const prosArr: string[] = JSON.parse((build as any).pros || "[]");
    const consArr: string[] = JSON.parse((build as any).cons || "[]");
    if (prosArr.length > 0) {
      prosConsText += "\n\n✅ Strengths:";
      prosArr.slice(0, 4).forEach(p => { prosConsText += `\n  • ${p}`; });
    }
    if (consArr.length > 0) {
      prosConsText += "\n\n⚠️ Weaknesses:";
      consArr.slice(0, 3).forEach(c => { prosConsText += `\n  • ${c}`; });
    }
  } catch {}

  const voteCount = (build as any).tierVoteCount ?? 0;
  return `${hookLine}

━━━━━━━━━━━━━━━
🏆 ${build.name}
🎮 ${gameName}
⚔️ ${build.className}${masteryPart}
📊 Tier: ${tierLabel} (${voteCount} players voted)
🔗 Guide: ${build.sourceType !== "other" ? build.sourceType : "Community"}
━━━━━━━━━━━━━━━

${voteCount > 0 ? `${voteCount} players agree: this build is ${tierLabel}!` : `Be one of the first to rate this build!`}

📌 Main Skills: ${skills}
💡 ${descShort}${prosConsText}

👉 Vote on BuildTier (link in bio)

${hashtags}`;
}

function generateTikTokContent(
  build: BuildWithSubmitter,
  gameName: string,
  tier: string,
  hookLine: string,
  hashtags: string,
): string {
  const tierLabel = getTierLabel(tier);
  const gameHashtag = getGameHashtag(gameName);
  const masteryPart = build.mastery ? ` ${build.mastery}` : "";

  // Top 3 reasons to try this build
  let top3 = "";
  try {
    const prosArr: string[] = JSON.parse((build as any).pros || "[]");
    if (prosArr.length > 0) {
      top3 = "\n\nTop 3 reasons to try this build:";
      prosArr.slice(0, 3).forEach((p, i) => { top3 += `\n${i + 1}. ${p}`; });
    }
  } catch {}

  return `${hookLine} #${gameHashtag}

Build: ${build.name}
Class: ${build.className}${masteryPart}
Tier: ${tierLabel} ⭐${top3}

Link in bio for the full tier list 🔗

${hashtags}`;
}

function generateYouTubeContent(
  build: BuildWithSubmitter,
  gameName: string,
  tier: string,
  hookLine: string,
  hashtags: string,
): string {
  const tierLabel = getTierLabel(tier);
  const skills = formatSkills(build.mainSkills);
  const masteryPart = build.mastery ? ` / ${build.mastery}` : "";

  return `${build.name} — ${tierLabel} | ${gameName} Build Guide

${hookLine}

⚔️ Class: ${build.className}${masteryPart}
📊 Community Score: ${build.upvotes - build.downvotes} (${build.upvotes} up / ${build.downvotes} down)
🎯 Skills: ${skills}

Vote on the community tier list: ${BUILDTIER_URL}
Guide: ${build.guideUrl}

${hashtags}`;
}

// ─── Main generator ─────────────────────────────────────────────

export interface GeneratedSocialPost {
  platform: string;
  content: string;
  hashtags: string;
  hookLine: string;
  tierLabel: string;
}

export function generateSocialPosts(
  build: BuildWithSubmitter,
  gameName: string,
  tier?: string,
): GeneratedSocialPost[] {
  const resolvedTier = tier ?? getTierForBuild(build);
  const tierLabel = getTierLabel(resolvedTier);

  const platforms = ["twitter", "instagram", "tiktok", "youtube_shorts"] as const;

  return platforms.map(platform => {
    const hookLine = generateHook(build, gameName, resolvedTier);

    let hashtags: string;
    let content: string;

    switch (platform) {
      case "twitter":
        hashtags = generateHashtagsTwitter(build, gameName, resolvedTier);
        content = generateTwitterContent(build, gameName, resolvedTier, hookLine, hashtags);
        break;
      case "instagram":
        hashtags = generateHashtagsInstagram(build, gameName, resolvedTier);
        content = generateInstagramContent(build, gameName, resolvedTier, hookLine, hashtags);
        break;
      case "tiktok":
        hashtags = generateHashtagsTikTok(build, gameName, resolvedTier);
        content = generateTikTokContent(build, gameName, resolvedTier, hookLine, hashtags);
        break;
      case "youtube_shorts":
        hashtags = generateHashtagsYouTube(build, gameName, resolvedTier);
        content = generateYouTubeContent(build, gameName, resolvedTier, hookLine, hashtags);
        break;
    }

    return { platform, content, hashtags, hookLine, tierLabel };
  });
}

export { getTierFromScore, getTierLabel };
