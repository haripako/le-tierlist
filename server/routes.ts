import type { Express } from "express";
import type { Server } from "http";
import { storage, verifyPassword, detectSource } from "./storage";
import { insertBuildSchema, insertSeasonSchema, insertGameSchema, insertGameClassSchema, insertGameModeSchema } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { extractBuildFromUrl } from "./extract";
import { generateSocialPosts, getTierFromScore } from "./social";
import crypto from "crypto";

// ─── Voter identity (cookie-based, stable across requests) ─────

function getVoterHash(req: any, res?: any): string {
  // Read voter_id from cookie — if missing, generate a new one and set it
  let voterId = req.cookies?.voter_id;
  if (!voterId) {
    voterId = crypto.randomUUID().replace(/-/g, "");
    if (res) {
      res.cookie("voter_id", voterId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  }
  return voterId;
}

// ─── DB init ───────────────────────────────────────────────────

function initDB() {
  // Games (with has_seasons column)
  db.run(sql`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#d4a537',
    icon TEXT NOT NULL DEFAULT '⚔️',
    category TEXT NOT NULL DEFAULT 'arpg',
    is_active INTEGER NOT NULL DEFAULT 1,
    has_seasons INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  // Game modes
  db.run(sql`CREATE TABLE IF NOT EXISTS game_modes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`);

  // Game classes
  db.run(sql`CREATE TABLE IF NOT EXISTS game_classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    masteries TEXT NOT NULL DEFAULT '[]',
    color TEXT NOT NULL DEFAULT '#888888'
  )`);

  // Users
  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    karma INTEGER NOT NULL DEFAULT 0,
    build_submissions INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  // Seasons (with game_id)
  db.run(sql`CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL DEFAULT 1,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    patch TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  // Builds (with game_mode_id)
  db.run(sql`CREATE TABLE IF NOT EXISTS builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL DEFAULT 1,
    game_class_id INTEGER,
    season_id INTEGER,
    game_mode_id INTEGER,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    mastery TEXT NOT NULL DEFAULT '',
    playstyle TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    main_skills TEXT NOT NULL DEFAULT '[]',
    guide_url TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'other',
    submitter_id INTEGER,
    anon_hash TEXT,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  // Votes
  db.run(sql`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique ON votes(build_id, user_id)`);

  // Anonymous votes
  db.run(sql`CREATE TABLE IF NOT EXISTS anon_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    voter_hash TEXT NOT NULL,
    vote_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_anon_votes_unique ON anon_votes(build_id, voter_hash)`);

  // Social posts
  db.run(sql`CREATE TABLE IF NOT EXISTS social_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    platform TEXT NOT NULL,
    content TEXT NOT NULL,
    hashtags TEXT NOT NULL,
    hook_line TEXT NOT NULL,
    tier_label TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  )`);

  // Seed if empty
  const gameCount = db.all(sql`SELECT count(*) as c FROM games`);
  // @ts-ignore
  if (gameCount[0]?.c === 0) seedData();
}

// ─── Source detection helper ────────────────────────────────────

function detectSourceFromUrl(url: string): string {
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
  } catch {
    return "other";
  }
}

// ─── Seed data ─────────────────────────────────────────────────

function seedData() {
  // ── Admin user ──
  const admin = storage.createUser({ username: "admin", passwordHash: "admin123" });
  db.run(sql`UPDATE users SET is_admin = 1 WHERE id = ${admin.id}`);

  // ── Community users ──
  const boardman = storage.createUser({ username: "Boardman21", passwordHash: "pass123" });
  const perry = storage.createUser({ username: "Perrythepig", passwordHash: "pass123" });
  const lizard = storage.createUser({ username: "LizardIRL", passwordHash: "pass123" });
  const mcfluffin = storage.createUser({ username: "McFluffin", passwordHash: "pass123" });
  const trem = storage.createUser({ username: "Trem", passwordHash: "pass123" });
  const epoch = storage.createUser({ username: "Epoch_Builds", passwordHash: "pass123" });

  db.run(sql`UPDATE users SET karma = 1250 WHERE id = ${boardman.id}`);
  db.run(sql`UPDATE users SET karma = 890 WHERE id = ${perry.id}`);
  db.run(sql`UPDATE users SET karma = 720 WHERE id = ${lizard.id}`);
  db.run(sql`UPDATE users SET karma = 540 WHERE id = ${mcfluffin.id}`);
  db.run(sql`UPDATE users SET karma = 480 WHERE id = ${trem.id}`);
  db.run(sql`UPDATE users SET karma = 350 WHERE id = ${epoch.id}`);

  const communityUsers = [boardman, perry, lizard, mcfluffin, trem, epoch];

  // ── Games ──
  const gamesData = [
    { slug: "last-epoch", name: "Last Epoch", color: "#d4a537", icon: "⚔️", category: "arpg", sortOrder: 100, hasSeasons: true },
    { slug: "diablo-4", name: "Diablo IV", color: "#b91c1c", icon: "💀", category: "arpg", sortOrder: 95, hasSeasons: true },
    { slug: "path-of-exile-2", name: "Path of Exile 2", color: "#c2410c", icon: "🔥", category: "arpg", sortOrder: 90, hasSeasons: true },
    { slug: "path-of-exile", name: "Path of Exile", color: "#9c6522", icon: "🌑", category: "arpg", sortOrder: 85, hasSeasons: true },
    { slug: "diablo-2-resurrected", name: "Diablo II Resurrected", color: "#7c3aed", icon: "☠️", category: "arpg", sortOrder: 80, hasSeasons: true },
    { slug: "diablo-3", name: "Diablo III", color: "#1d4ed8", icon: "🏹", category: "arpg", sortOrder: 75, hasSeasons: true },
    { slug: "grim-dawn", name: "Grim Dawn", color: "#6b7280", icon: "🌿", category: "arpg", sortOrder: 70, hasSeasons: false },
    { slug: "torchlight-infinite", name: "Torchlight Infinite", color: "#0891b2", icon: "🔦", category: "arpg", sortOrder: 65, hasSeasons: true },
    { slug: "destiny-2", name: "Destiny 2", color: "#1e3a5f", icon: "🚀", category: "looter-shooter", sortOrder: 60, hasSeasons: true },
    { slug: "borderlands-3", name: "Borderlands 3", color: "#f59e0b", icon: "💥", category: "looter-shooter", sortOrder: 55, hasSeasons: false },
    { slug: "borderlands-4", name: "Borderlands 4", color: "#d97706", icon: "💥", category: "looter-shooter", sortOrder: 50, hasSeasons: false },
    { slug: "fallout-4", name: "Fallout 4", color: "#4d7c0f", icon: "☢️", category: "other", sortOrder: 40, hasSeasons: false },
    { slug: "crimson-desert", name: "Crimson Desert", color: "#991b1b", icon: "🗡️", category: "other", sortOrder: 35, hasSeasons: false },
  ];

  const createdGames: Record<string, any> = {};
  for (const g of gamesData) {
    createdGames[g.slug] = storage.createGame({
      slug: g.slug, name: g.name, color: g.color, icon: g.icon,
      category: g.category as any, isActive: true, sortOrder: g.sortOrder, hasSeasons: g.hasSeasons,
    });
  }

  // ── Game Classes ──
  const leId = createdGames["last-epoch"].id;
  const d4Id = createdGames["diablo-4"].id;
  const poe2Id = createdGames["path-of-exile-2"].id;
  const poeId = createdGames["path-of-exile"].id;
  const d2rId = createdGames["diablo-2-resurrected"].id;
  const d3Id = createdGames["diablo-3"].id;
  const gdId = createdGames["grim-dawn"].id;
  const tlId = createdGames["torchlight-infinite"].id;
  const d2Id = createdGames["destiny-2"].id;
  const bl3Id = createdGames["borderlands-3"].id;
  const bl4Id = createdGames["borderlands-4"].id;
  const fo4Id = createdGames["fallout-4"].id;
  const cdId = createdGames["crimson-desert"].id;

  // Last Epoch classes
  const leClasses = [
    { name: "Sentinel", masteries: ["Void Knight", "Forge Guard", "Paladin"], color: "#d4a537" },
    { name: "Mage", masteries: ["Sorcerer", "Spellblade", "Runemaster"], color: "#5b8dd9" },
    { name: "Primalist", masteries: ["Beastmaster", "Shaman", "Druid"], color: "#4dab6d" },
    { name: "Rogue", masteries: ["Bladedancer", "Marksman", "Falconer"], color: "#9b59b6" },
    { name: "Acolyte", masteries: ["Necromancer", "Lich", "Warlock"], color: "#c0392b" },
  ];
  for (const c of leClasses) {
    storage.createGameClass({ gameId: leId, name: c.name, masteries: JSON.stringify(c.masteries), color: c.color });
  }

  // Diablo IV classes
  for (const name of ["Barbarian", "Necromancer", "Sorcerer", "Druid", "Rogue", "Spiritborn", "Paladin"]) {
    storage.createGameClass({ gameId: d4Id, name, masteries: "[]", color: "#b91c1c" });
  }

  // Path of Exile 2 classes
  const poe2Classes = [
    { name: "Warrior", masteries: ["Titan", "Warbringer"] },
    { name: "Ranger", masteries: ["Deadeye", "Pathfinder"] },
    { name: "Witch", masteries: ["Infernalist", "Blood Mage"] },
    { name: "Mercenary", masteries: ["Witchhunter", "Gemling Legionnaire"] },
    { name: "Monk", masteries: ["Invoker", "Acolyte of Chayula"] },
    { name: "Sorceress", masteries: ["Stormweaver", "Chronomancer"] },
    { name: "Huntress", masteries: ["Amazon", "Ritualist"] },
    { name: "Druid", masteries: ["Lich", "Warden"] },
  ];
  for (const c of poe2Classes) {
    storage.createGameClass({ gameId: poe2Id, name: c.name, masteries: JSON.stringify(c.masteries), color: "#c2410c" });
  }

  // Path of Exile classes
  for (const name of ["Duelist", "Marauder", "Ranger", "Shadow", "Templar", "Witch", "Scion"]) {
    storage.createGameClass({ gameId: poeId, name, masteries: "[]", color: "#9c6522" });
  }

  // Diablo II Resurrected
  for (const name of ["Amazon", "Necromancer", "Barbarian", "Sorceress", "Paladin", "Druid", "Assassin", "Warlock"]) {
    storage.createGameClass({ gameId: d2rId, name, masteries: "[]", color: "#7c3aed" });
  }

  // Diablo III
  for (const name of ["Barbarian", "Crusader", "Demon Hunter", "Monk", "Necromancer", "Witch Doctor", "Wizard"]) {
    storage.createGameClass({ gameId: d3Id, name, masteries: "[]", color: "#1d4ed8" });
  }

  // Grim Dawn — dual class combos as classes
  for (const name of [
    "Warder (Soldier + Shaman)", "Dervish (Oathkeeper + Nightblade)", "Reaper (Nightblade + Necromancer)",
    "Blademaster (Soldier + Nightblade)", "Shieldbreaker (Demolitionist + Oathkeeper)",
    "Sentinel (Inquisitor + Shaman)", "Conjurer (Occultist + Shaman)", "Ritualist (Occultist + Shaman)",
    "Cabalist (Occultist + Arcanist)", "Witch Hunter (Inquisitor + Nightblade)",
    "Purifier (Demolitionist + Inquisitor)", "Oppressor (Occultist + Inquisitor)"
  ]) {
    storage.createGameClass({ gameId: gdId, name, masteries: "[]", color: "#6b7280" });
  }

  // Torchlight Infinite
  for (const name of ["Youga", "Gemma", "Erica", "Thea", "Rosa", "Karano", "Bing", "Rehan", "Iris"]) {
    storage.createGameClass({ gameId: tlId, name, masteries: "[]", color: "#0891b2" });
  }

  // Destiny 2
  const d2Classes = [
    { name: "Hunter", masteries: ["Solar", "Arc", "Void", "Stasis", "Strand"] },
    { name: "Titan", masteries: ["Solar", "Arc", "Void", "Stasis", "Strand"] },
    { name: "Warlock", masteries: ["Solar", "Arc", "Void", "Stasis", "Strand"] },
  ];
  for (const c of d2Classes) {
    storage.createGameClass({ gameId: d2Id, name: c.name, masteries: JSON.stringify(c.masteries), color: "#1e3a5f" });
  }

  // Borderlands 3
  for (const name of ["Amara", "FL4K", "Moze", "Zane"]) {
    storage.createGameClass({ gameId: bl3Id, name, masteries: "[]", color: "#f59e0b" });
  }

  // Borderlands 4
  for (const name of ["Amon the Forgeknight", "Rafa the Exo-Soldier", "C4SH the Rogue", "Harlowe the Gravitar", "Vex the Siren"]) {
    storage.createGameClass({ gameId: bl4Id, name, masteries: "[]", color: "#d97706" });
  }

  // Fallout 4 (playstyle-based)
  for (const name of ["Rifleman", "Melee", "Heavy Weapons", "Sniper", "Pistol", "Automatic", "VATS", "Speech", "Heavy", "Unarmed", "Diplomat", "Rifle"]) {
    storage.createGameClass({ gameId: fo4Id, name, masteries: "[]", color: "#4d7c0f" });
  }

  // Crimson Desert
  for (const name of ["Kliff", "Oongka"]) {
    storage.createGameClass({ gameId: cdId, name, masteries: "[]", color: "#991b1b" });
  }

  // ── Game Modes ──
  type ModeEntry = { name: string; slug: string; isDefault: boolean; sortOrder: number };
  const gameModeData: Record<string, ModeEntry[]> = {
    "last-epoch": [
      { name: "Softcore", slug: "softcore", isDefault: true, sortOrder: 0 },
      { name: "Hardcore", slug: "hardcore", isDefault: false, sortOrder: 1 },
      { name: "Solo Challenge", slug: "solo-challenge", isDefault: false, sortOrder: 2 },
    ],
    "diablo-4": [
      { name: "Softcore", slug: "softcore", isDefault: true, sortOrder: 0 },
      { name: "Hardcore", slug: "hardcore", isDefault: false, sortOrder: 1 },
      { name: "PvP (Fields of Hatred)", slug: "pvp", isDefault: false, sortOrder: 2 },
    ],
    "path-of-exile-2": [
      { name: "Trade SC", slug: "trade-sc", isDefault: true, sortOrder: 0 },
      { name: "Trade HC", slug: "trade-hc", isDefault: false, sortOrder: 1 },
      { name: "SSF SC", slug: "ssf-sc", isDefault: false, sortOrder: 2 },
      { name: "SSF HC", slug: "ssf-hc", isDefault: false, sortOrder: 3 },
    ],
    "path-of-exile": [
      { name: "Trade SC", slug: "trade-sc", isDefault: true, sortOrder: 0 },
      { name: "Trade HC", slug: "trade-hc", isDefault: false, sortOrder: 1 },
      { name: "SSF SC", slug: "ssf-sc", isDefault: false, sortOrder: 2 },
      { name: "SSF HC", slug: "ssf-hc", isDefault: false, sortOrder: 3 },
    ],
    "diablo-2-resurrected": [
      { name: "Softcore", slug: "softcore", isDefault: true, sortOrder: 0 },
      { name: "Hardcore", slug: "hardcore", isDefault: false, sortOrder: 1 },
      { name: "Ladder", slug: "ladder", isDefault: false, sortOrder: 2 },
      { name: "Non-Ladder", slug: "non-ladder", isDefault: false, sortOrder: 3 },
    ],
    "diablo-3": [
      { name: "Softcore", slug: "softcore", isDefault: true, sortOrder: 0 },
      { name: "Hardcore", slug: "hardcore", isDefault: false, sortOrder: 1 },
      { name: "Seasonal", slug: "seasonal", isDefault: false, sortOrder: 2 },
      { name: "Non-Seasonal", slug: "non-seasonal", isDefault: false, sortOrder: 3 },
    ],
    "grim-dawn": [
      { name: "Softcore", slug: "softcore", isDefault: true, sortOrder: 0 },
      { name: "Hardcore", slug: "hardcore", isDefault: false, sortOrder: 1 },
      { name: "Crucible", slug: "crucible", isDefault: false, sortOrder: 2 },
      { name: "Shattered Realm", slug: "shattered-realm", isDefault: false, sortOrder: 3 },
    ],
    "torchlight-infinite": [
      { name: "Softcore", slug: "softcore", isDefault: true, sortOrder: 0 },
      { name: "Hardcore", slug: "hardcore", isDefault: false, sortOrder: 1 },
      { name: "SSF", slug: "ssf", isDefault: false, sortOrder: 2 },
    ],
    "destiny-2": [
      { name: "PvE", slug: "pve", isDefault: true, sortOrder: 0 },
      { name: "PvP (Crucible)", slug: "pvp", isDefault: false, sortOrder: 1 },
      { name: "PvPvE (Gambit)", slug: "pvpve", isDefault: false, sortOrder: 2 },
    ],
    "borderlands-3": [
      { name: "PvE", slug: "pve", isDefault: true, sortOrder: 0 },
      { name: "Mayhem 11", slug: "mayhem-11", isDefault: false, sortOrder: 1 },
    ],
    "borderlands-4": [
      { name: "Standard", slug: "standard", isDefault: true, sortOrder: 0 },
      { name: "UVHM", slug: "uvhm", isDefault: false, sortOrder: 1 },
    ],
    "fallout-4": [
      { name: "Normal", slug: "normal", isDefault: true, sortOrder: 0 },
      { name: "Survival", slug: "survival", isDefault: false, sortOrder: 1 },
    ],
    "crimson-desert": [
      { name: "PvE", slug: "pve", isDefault: true, sortOrder: 0 },
    ],
  };

  const createdModes: Record<string, Record<string, any>> = {};
  for (const [gameSlug, modes] of Object.entries(gameModeData)) {
    const game = createdGames[gameSlug];
    createdModes[gameSlug] = {};
    for (const mode of modes) {
      const created = storage.createGameMode({
        gameId: game.id,
        name: mode.name,
        slug: mode.slug,
        isDefault: mode.isDefault,
        sortOrder: mode.sortOrder,
      });
      createdModes[gameSlug][mode.slug] = created;
    }
  }

  // ── Seasons ──
  // Last Epoch
  const leS4 = storage.createSeason({ gameId: leId, slug: "le-s4", name: "Season 4 — Shattered Omens", patch: "1.4", isActive: true, sortOrder: 5 });
  const leS3 = storage.createSeason({ gameId: leId, slug: "le-s3", name: "Season 3 — Beneath Ancient Skies", patch: "1.3", isActive: true, sortOrder: 4 });
  storage.createSeason({ gameId: leId, slug: "le-s2", name: "Season 2 — Tombs of the Erased", patch: "1.2", isActive: true, sortOrder: 3 });
  storage.createSeason({ gameId: leId, slug: "le-s1", name: "Season 1 — Harbingers of Ruin", patch: "1.1", isActive: true, sortOrder: 2 });
  storage.createSeason({ gameId: leId, slug: "le-release", name: "Release (1.0)", patch: "1.0", isActive: true, sortOrder: 1 });

  // Diablo IV
  const d4S12 = storage.createSeason({ gameId: d4Id, slug: "d4-s12", name: "Season 12: Season of Slaughter", patch: "2.2", isActive: true, sortOrder: 5 });
  storage.createSeason({ gameId: d4Id, slug: "d4-s11", name: "Season 11: Season of Hatred Rising", patch: "2.1", isActive: false, sortOrder: 4 });

  // Path of Exile 2
  const poe2S4 = storage.createSeason({ gameId: poe2Id, slug: "poe2-fate-vaal", name: "Fate of the Vaal (0.4.0)", patch: "0.4.0", isActive: true, sortOrder: 3 });
  storage.createSeason({ gameId: poe2Id, slug: "poe2-s3", name: "Dawn of the Hunt (0.3.0)", patch: "0.3.0", isActive: false, sortOrder: 2 });

  // Path of Exile
  const poeS28 = storage.createSeason({ gameId: poeId, slug: "poe-3-28", name: "3.28 Mirage", patch: "3.28", isActive: true, sortOrder: 5 });
  storage.createSeason({ gameId: poeId, slug: "poe-3-27", name: "3.27 Settlers of Kalguur", patch: "3.27", isActive: false, sortOrder: 4 });

  // Diablo II Resurrected
  const d2rS13 = storage.createSeason({ gameId: d2rId, slug: "d2r-ladder-s13", name: "Ladder Season 13", patch: "2.7", isActive: true, sortOrder: 5 });

  // Diablo III
  const d3S38 = storage.createSeason({ gameId: d3Id, slug: "d3-s38", name: "Season 38: Ethereal Memory", patch: "2.7.8", isActive: true, sortOrder: 5 });

  // Torchlight Infinite
  const tlSS11 = storage.createSeason({ gameId: tlId, slug: "tl-ss11", name: "SS11 Vorax Season", patch: "SS11", isActive: true, sortOrder: 5 });

  // Destiny 2
  const d2SeasonLawless = storage.createSeason({ gameId: d2Id, slug: "d2-season-lawless", name: "Season: Lawless", patch: "2026", isActive: true, sortOrder: 5 });

  // ── Real Builds — 195 total (15 per game) ──
  // Helper to get random user
  function getUser(idx: number) { return communityUsers[idx % communityUsers.length]; }
  function randVotes(base: number, variance: number) {
    return base + Math.floor(Math.random() * variance);
  }

  // ─ Last Epoch (15 builds) ─
  const leDefaultMode = createdModes["last-epoch"]["softcore"];
  const leBuilds = [
    { name: "Warpath Void Knight", className: "Sentinel", mastery: "Void Knight", guideUrl: "https://maxroll.gg/last-epoch/build-guides/warpath-void-knight", description: "Spinning to win with Void damage echoes. High mobility and damage output.", playstyle: "melee" },
    { name: "Ballista Falconer", className: "Rogue", mastery: "Falconer", guideUrl: "https://maxroll.gg/last-epoch/build-guides/ballista-falconer", description: "Turret-based ranged build with massive DPS potential from multiple ballistae.", playstyle: "ranged" },
    { name: "Erasing Strike Void Knight", className: "Sentinel", mastery: "Void Knight", guideUrl: "https://www.lastepochtools.com/builds/erasing-strike-void-knight", description: "One of the highest single-target DPS builds in the game using Void echoes.", playstyle: "melee" },
    { name: "Judgement Aura Paladin", className: "Sentinel", mastery: "Paladin", guideUrl: "https://maxroll.gg/last-epoch/build-guides/judgement-paladin", description: "Holy damage AoE build that clears maps incredibly fast with Judgement and Aura.", playstyle: "melee" },
    { name: "Anurok Frogs Beastmaster", className: "Primalist", mastery: "Beastmaster", guideUrl: "https://maxroll.gg/last-epoch/build-guides/beastmaster-frogs", description: "Unique frog minion build with high chaos clear speed in S4.", playstyle: "summoner" },
    { name: "Lightning Blast Runemaster", className: "Mage", mastery: "Runemaster", guideUrl: "https://www.lastepochtools.com/builds/runemaster-lightning", description: "Chain lightning Runemaster with insane pack clear using Runic Invocation combos.", playstyle: "caster" },
    { name: "Abomination Necromancer", className: "Acolyte", mastery: "Necromancer", guideUrl: "https://maxroll.gg/last-epoch/build-guides/abomination-necromancer", description: "Melee minion juggernaut — your Abomination grows stronger with each kill.", playstyle: "summoner" },
    { name: "Rip Blood Warlock", className: "Acolyte", mastery: "Warlock", guideUrl: "https://www.lastepochtools.com/builds/rip-blood-warlock", description: "Blood magic build that sacrifices health for incredible damage output.", playstyle: "caster" },
    { name: "Storm Crows Beastmaster", className: "Primalist", mastery: "Beastmaster", guideUrl: "https://www.lastepochtools.com/builds/beastmaster-storm-crows", description: "Crow minion build with storm synergies for large AoE clear.", playstyle: "summoner" },
    { name: "Profane Veil Warlock", className: "Acolyte", mastery: "Warlock", guideUrl: "https://www.lastepochtools.com/builds/profane-veil-warlock", description: "Near-unkillable Warlock using Profane Veil for constant damage mitigation.", playstyle: "caster" },
    { name: "Zombie Warlock", className: "Acolyte", mastery: "Warlock", guideUrl: "https://maxroll.gg/last-epoch/build-guides/zombie-warlock", description: "Endless zombie army with exceptional clear speed. Very relaxed playstyle.", playstyle: "summoner" },
    { name: "Flay Mana Lich", className: "Acolyte", mastery: "Lich", guideUrl: "https://www.lastepochtools.com/builds/lich-flay", description: "Mana-fed Lich that unleashes devastating Flay and Reaper Form.", playstyle: "caster" },
    { name: "Bladestorm Bladedancer", className: "Rogue", mastery: "Bladedancer", guideUrl: "https://maxroll.gg/last-epoch/build-guides/bladedancer-bladestorm", description: "Whirlwind blade melee with incredible movement speed and proc generation.", playstyle: "melee" },
    { name: "Judgement Paladin", className: "Sentinel", mastery: "Paladin", guideUrl: "https://www.lastepochtools.com/builds/paladin-judgement-hc", description: "Safe HC Paladin with maximum block, Sigils stacks, and Holy damage.", playstyle: "melee" },
    { name: "Fire Aura Spellblade", className: "Mage", mastery: "Spellblade", guideUrl: "https://maxroll.gg/last-epoch/build-guides/spellblade-fire-aura", description: "Melee fire caster with Enchant Weapon and Surge for blazing DPS.", playstyle: "hybrid" },
  ];
  for (let i = 0; i < leBuilds.length; i++) {
    const b = leBuilds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: leId, gameModeId: leDefaultMode.id, seasonId: leS4.id,
      name: b.name, className: b.className, mastery: b.mastery ?? "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Diablo IV (15 builds) ─
  const d4DefaultMode = createdModes["diablo-4"]["softcore"];
  const d4Builds = [
    { name: "Thorns Blessed Shield Paladin", className: "Paladin", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/thorns-blessed-shield-paladin", description: "Thorns-scaling Paladin that reflects massive damage back to enemies.", playstyle: "melee" },
    { name: "Blessed Hammer Paladin", className: "Paladin", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/blessed-hammer-paladin", description: "Classic Hammerdin revived for D4 with Blessed Hammer creating spinning projectiles.", playstyle: "melee" },
    { name: "Aura Paladin (Auradin)", className: "Paladin", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/aura-paladin", description: "Passive aura-driven build that damages everything on screen permanently.", playstyle: "melee" },
    { name: "Wing Strikes Paladin", className: "Paladin", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/wing-strikes-paladin", description: "Aerial attack Paladin with massive burst damage on demand.", playstyle: "melee" },
    { name: "Pulverize Druid", className: "Druid", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/pulverize-druid", description: "Werebear form slamming everything with Pulverize — huge AoE and great sustain.", playstyle: "melee" },
    { name: "Hammer of the Ancients Barbarian", className: "Barbarian", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/hota-barbarian", description: "Single massive hammer blow that obliterates all enemies in one hit.", playstyle: "melee" },
    { name: "Lunging Strike Barbarian", className: "Barbarian", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/lunging-strike-barbarian", description: "Frenzy-stacking brawler with high uptime damage and great mobility.", playstyle: "melee" },
    { name: "Crackling Energy Sorcerer", className: "Sorcerer", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/crackling-energy-sorcerer", description: "Lightning Sorcerer that passively spawns Crackling Energy orbs for massive damage.", playstyle: "caster" },
    { name: "Payback Spiritborn", className: "Spiritborn", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/payback-spiritborn", description: "Spirit-powered retaliation build with insane damage scaling on tanky characters.", playstyle: "hybrid" },
    { name: "Infinite Evade Eagle Spiritborn", className: "Spiritborn", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/eagle-spiritborn-evade", description: "Eagle aspect Spiritborn with infinite Evade charges for constant repositioning.", playstyle: "ranged" },
    { name: "Golem Necromancer", className: "Necromancer", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/golem-necromancer", description: "Iron Golem as the primary damage dealer with Necromancer buffs and minions.", playstyle: "summoner" },
    { name: "Shadow Blight Necromancer", className: "Necromancer", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/shadow-blight-necromancer", description: "Shadow realm DoT build with excellent wave clear through Blight explosions.", playstyle: "caster" },
    { name: "Heartseeker Rogue", className: "Rogue", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/heartseeker-rogue", description: "Bow Rogue using Heartseeker to rapidly stack critical hit multipliers.", playstyle: "ranged" },
    { name: "Death Trap Rogue", className: "Rogue", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/death-trap-rogue", description: "Trap placement build with massive burst on boss encounters using Death Trap.", playstyle: "ranged" },
    { name: "Earthquake Barbarian", className: "Barbarian", mastery: "", guideUrl: "https://maxroll.gg/d4/build-guides/earthquake-barbarian", description: "Ground-shaking melee Barbarian with stacking Earthquake damage on all enemies.", playstyle: "melee" },
  ];
  for (let i = 0; i < d4Builds.length; i++) {
    const b = d4Builds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: d4Id, gameModeId: d4DefaultMode.id, seasonId: d4S12.id,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Path of Exile 2 (15 builds) ─
  const poe2DefaultMode = createdModes["path-of-exile-2"]["trade-sc"];
  const poe2Builds = [
    { name: "Pathfinder Ladder Topper", className: "Ranger", mastery: "", guideUrl: "https://poe.ninja/builds/0.4?class=Ranger&corePassive=Pathfinder", description: "Top ladder Ranger using Pathfinder ascendancy for explosive flask scaling.", playstyle: "ranged" },
    { name: "Titan Drubringer", className: "Warrior", mastery: "Titan", guideUrl: "https://maxroll.gg/poe2/build-guides/titan-warrior", description: "Massive ground slammer Titan that deals devastating blunt melee damage.", playstyle: "melee" },
    { name: "Amazon Resurrect Ranger", className: "Ranger", mastery: "", guideUrl: "https://www.youtube.com/watch?v=poe2_ranger_s4", description: "Resurrection-stacking Amazon-spec Ranger with summon synergies.", playstyle: "summoner" },
    { name: "Smith of Kitava Warrior", className: "Warrior", mastery: "Warbringer", guideUrl: "https://maxroll.gg/poe2/build-guides/smith-kitava-warrior", description: "Forge god Warrior that summons spectral weapons and overwhelms enemies.", playstyle: "melee" },
    { name: "Lich Malarz Witch", className: "Witch", mastery: "Blood Mage", guideUrl: "https://maxroll.gg/poe2/build-guides/witch-lich", description: "Death magic Witch with Lich spectres that reanimate slain enemies.", playstyle: "summoner" },
    { name: "Oracle Druid", className: "Druid", mastery: "Warden", guideUrl: "https://maxroll.gg/poe2/build-guides/oracle-druid", description: "Prophetic oracle gameplay loop with high defensive layering.", playstyle: "caster" },
    { name: "Titan Bear Wall", className: "Warrior", mastery: "Titan", guideUrl: "https://www.youtube.com/watch?v=poe2_titan_bear", description: "Nearly unkillable defensive Titan using totems and auras for permanent survival.", playstyle: "hybrid" },
    { name: "Huntress Spear Dive", className: "Huntress", mastery: "Amazon", guideUrl: "https://maxroll.gg/poe2/build-guides/huntress-spear", description: "Flying spear Amazon with incredible single-target DPS and mobility.", playstyle: "ranged" },
    { name: "Infernalist Fire Bomb", className: "Witch", mastery: "Infernalist", guideUrl: "https://maxroll.gg/poe2/build-guides/infernalist-witch", description: "Demonic fire-bomb playstyle with massive explosion radius and lingering flames.", playstyle: "caster" },
    { name: "Stormweaver Arc Sorceress", className: "Sorceress", mastery: "Stormweaver", guideUrl: "https://maxroll.gg/poe2/build-guides/stormweaver-arc", description: "Chain lightning Sorceress that bounces arc through entire screens of enemies.", playstyle: "caster" },
    { name: "Deadeye Tornado Shot", className: "Ranger", mastery: "Deadeye", guideUrl: "https://maxroll.gg/poe2/build-guides/deadeye-tornado-shot", description: "Bow-wielding Deadeye with tornado arrows piercing and bouncing through packs.", playstyle: "ranged" },
    { name: "Invoker Monk Glacial", className: "Monk", mastery: "Invoker", guideUrl: "https://maxroll.gg/poe2/build-guides/invoker-monk-glacial", description: "Hand-to-hand ice monk freezing entire screens with glacial detonations.", playstyle: "melee" },
    { name: "Chronomancer Time Loop", className: "Sorceress", mastery: "Chronomancer", guideUrl: "https://www.youtube.com/watch?v=poe2_chrono", description: "Rewind time mechanics for maximum damage loops and defensive resets.", playstyle: "caster" },
    { name: "SSF Starter Mercenary", className: "Mercenary", mastery: "Witchhunter", guideUrl: "https://maxroll.gg/poe2/build-guides/mercenary-witchhunter-ssf", description: "Budget-friendly Witchhunter Mercenary that excels without expensive items.", playstyle: "ranged" },
    { name: "Pathfinder Flask Ranger", className: "Ranger", mastery: "Pathfinder", guideUrl: "https://maxroll.gg/poe2/build-guides/pathfinder-flask-ranger", description: "Classic flask scaling build with permanent uptime on all flasks.", playstyle: "ranged" },
  ];
  for (let i = 0; i < poe2Builds.length; i++) {
    const b = poe2Builds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: poe2Id, gameModeId: poe2DefaultMode.id, seasonId: poe2S4.id,
      name: b.name, className: b.className, mastery: b.mastery ?? "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Path of Exile (15 builds) ─
  const poeDefaultMode = createdModes["path-of-exile"]["trade-sc"];
  const poeBuilds = [
    { name: "Kinetic Fusillade Hierophant", className: "Templar", mastery: "", guideUrl: "https://poe.ninja/builds/3.28?class=Templar&corePassive=Hierophant", description: "Totem-buffed Kinetic Blast Hierophant with incredible pack-clearing speed.", playstyle: "ranged" },
    { name: "Righteous Fire Chieftain", className: "Marauder", mastery: "", guideUrl: "https://poe.ninja/builds/3.28?class=Marauder&corePassive=Chieftain", description: "Classic RF build that burns everything including the character for damage scaling.", playstyle: "caster" },
    { name: "Elemental Hit Slayer", className: "Duelist", mastery: "", guideUrl: "https://poe.ninja/builds/3.28?class=Duelist&corePassive=Slayer", description: "Elemental hit Slayer with one-shot potential on any random element.", playstyle: "ranged" },
    { name: "Lightning Arrow Deadeye", className: "Ranger", mastery: "", guideUrl: "https://poe.ninja/builds/3.28?class=Ranger&corePassive=Deadeye", description: "Top ladder bow build in 3.28 with chain lightning clearing entire maps.", playstyle: "ranged" },
    { name: "Kinetic Blast Necromancer", className: "Witch", mastery: "", guideUrl: "https://poe.ninja/builds/3.28?class=Witch&corePassive=Necromancer", description: "Wand-wielding Witch with explosions from Kinetic Blast chaining everywhere.", playstyle: "caster" },
    { name: "Absolution Guardian", className: "Templar", mastery: "", guideUrl: "https://www.youtube.com/watch?v=poe_guardian_abs", description: "Minion summoner Guardian with Absolution spectres and massive aura stacking.", playstyle: "summoner" },
    { name: "Flicker Strike Gladiator", className: "Duelist", mastery: "", guideUrl: "https://www.youtube.com/watch?v=poe_flicker_glad", description: "Teleporting melee madness with Flicker Strike at impossible speed.", playstyle: "melee" },
    { name: "Holy Flame Totem Inquisitor", className: "Templar", mastery: "", guideUrl: "https://www.youtube.com/watch?v=poe_inquisitor_totem", description: "Budget-friendly Inquisitor placer with fire totems for excellent wave clear.", playstyle: "caster" },
    { name: "Shock Nova Archmage Hierophant", className: "Templar", mastery: "", guideUrl: "https://www.youtube.com/watch?v=poe_shock_nova", description: "Massive mana-investment Archmage build with Shock Nova for insane damage.", playstyle: "caster" },
    { name: "Exsanguinate Reap Miner Saboteur", className: "Shadow", mastery: "", guideUrl: "https://www.youtube.com/watch?v=poe_saboteur_mine", description: "Mine spammer Saboteur using blood spells for devastating detonation chains.", playstyle: "caster" },
    { name: "Toxic Rain Pathfinder", className: "Ranger", mastery: "", guideUrl: "https://maxroll.gg/poe/build-guides/toxic-rain-pathfinder", description: "Bow DoT build that rains poison pods for relentless area denial.", playstyle: "ranged" },
    { name: "Siege Ballista Hierophant", className: "Templar", mastery: "", guideUrl: "https://maxroll.gg/poe/build-guides/siege-ballista-hierophant", description: "Turret placement build with high DPS ceiling from stacked ballista totems.", playstyle: "ranged" },
    { name: "Sunder Ignite Elementalist", className: "Witch", mastery: "", guideUrl: "https://maxroll.gg/poe/build-guides/sunder-ignite-elementalist", description: "Melee ignite Elementalist with guaranteed spreading fire from every Sunder.", playstyle: "melee" },
    { name: "Poison SRS Necromancer", className: "Witch", mastery: "", guideUrl: "https://maxroll.gg/poe/build-guides/poison-srs-necromancer", description: "Spirit minions coated in poison for ramping DoT damage on all enemies.", playstyle: "summoner" },
    { name: "Cyclone Slayer", className: "Duelist", mastery: "", guideUrl: "https://maxroll.gg/poe/build-guides/cyclone-slayer", description: "Classic Cyclone for infinite spinning and blade vortex overlapping.", playstyle: "melee" },
  ];
  for (let i = 0; i < poeBuilds.length; i++) {
    const b = poeBuilds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: poeId, gameModeId: poeDefaultMode.id, seasonId: poeS28.id,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Diablo II Resurrected (15 builds) ─
  const d2rDefaultMode = createdModes["diablo-2-resurrected"]["softcore"];
  const d2rBuilds = [
    { name: "Blizzard Sorceress", className: "Sorceress", guideUrl: "https://maxroll.gg/d2/guides/blizzard-sorceress", description: "Fast leveling and farming with cold AoE damage and teleport mobility.", playstyle: "caster" },
    { name: "Fist of the Heavens Paladin", className: "Paladin", guideUrl: "https://www.icy-veins.com/d2/fist-of-the-heavens-paladin-build", description: "Massive holy bolt damage for clearing packs of undead and demons.", playstyle: "caster" },
    { name: "Blessed Hammer Paladin", className: "Paladin", guideUrl: "https://maxroll.gg/d2/guides/blessed-hammer-paladin", description: "Magic damage hammers ignore immunities for versatile clearing.", playstyle: "melee" },
    { name: "Hydra Sorceress", className: "Sorceress", guideUrl: "https://maxroll.gg/d2/guides/hydra-sorceress", description: "Ranged fire damage with hydras for bossing and area clear.", playstyle: "caster" },
    { name: "Smite Paladin", className: "Paladin", guideUrl: "https://www.icy-veins.com/d2/smiter-paladin-build", description: "Boss killer with guaranteed hits and crushing blow for Ubers.", playstyle: "melee" },
    { name: "Lightning Fury Amazon", className: "Amazon", guideUrl: "https://maxroll.gg/d2/guides/lightning-fury-amazon", description: "Chain lightning javelin that bounces between enemies for massive clear.", playstyle: "ranged" },
    { name: "Berserk Barbarian", className: "Barbarian", guideUrl: "https://maxroll.gg/d2/guides/berserk-barbarian", description: "Berserking physical-to-magic converter for dealing with physical immune demons.", playstyle: "melee" },
    { name: "Lightning Sentry Assassin", className: "Assassin", guideUrl: "https://maxroll.gg/d2/guides/lightning-sentry-assassin", description: "Trap-setting Assassin that fills areas with electrocuting Lightning Sentries.", playstyle: "caster" },
    { name: "Summon Necromancer", className: "Necromancer", guideUrl: "https://maxroll.gg/d2/guides/summon-necromancer", description: "Army of skeletons and golems to overwhelm anything. Very safe playstyle.", playstyle: "summoner" },
    { name: "Fire Wall Sorceress", className: "Sorceress", guideUrl: "https://maxroll.gg/d2/guides/fire-wall-sorceress", description: "Immovable fire walls that enemies must walk through for constant burning damage.", playstyle: "caster" },
    { name: "Frozen Orb Sorceress", className: "Sorceress", guideUrl: "https://maxroll.gg/d2/guides/frozen-orb-sorceress", description: "Classic cold build with Frozen Orb for exceptional AoE coverage.", playstyle: "caster" },
    { name: "Mosaic Assassin", className: "Assassin", guideUrl: "https://maxroll.gg/d2/guides/mosaic-assassin", description: "Charge-up Claws of Thunder Assassin with the Mosaic unique for incredible DPS.", playstyle: "melee" },
    { name: "Fissure Druid", className: "Druid", guideUrl: "https://maxroll.gg/d2/guides/fissure-druid", description: "Fire elementalist Druid raining Fissure and Volcano for exceptional fire damage.", playstyle: "caster" },
    { name: "Bone Spear Necromancer", className: "Necromancer", guideUrl: "https://www.icy-veins.com/d2/bone-spear-necromancer-build", description: "Physical damage bone spears that bypass all resistances for versatile bossing.", playstyle: "caster" },
    { name: "Whirlwind Barbarian", className: "Barbarian", guideUrl: "https://maxroll.gg/d2/guides/whirlwind-barbarian", description: "The iconic Barbarian spinning attack with dual-wield for maximum hits.", playstyle: "melee" },
  ];
  for (let i = 0; i < d2rBuilds.length; i++) {
    const b = d2rBuilds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: d2rId, gameModeId: d2rDefaultMode.id, seasonId: d2rS13.id,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Diablo III (15 builds) ─
  const d3DefaultMode = createdModes["diablo-3"]["softcore"];
  const d3Builds = [
    { name: "Rathma Death Nova Necromancer", className: "Necromancer", guideUrl: "https://maxroll.gg/d3/build-guides/rathma-death-nova-necromancer", description: "Rathma set Necromancer spamming Death Nova for entire-screen AoE coverage.", playstyle: "caster" },
    { name: "LoD Death Nova Necromancer", className: "Necromancer", guideUrl: "https://maxroll.gg/d3/build-guides/lod-death-nova-necromancer", description: "Legacy of Dreams Death Nova — budget-friendly and extremely potent.", playstyle: "caster" },
    { name: "Inarius Death Nova Necromancer", className: "Necromancer", guideUrl: "https://maxroll.gg/d3/build-guides/inarius-death-nova", description: "Bone armor-buffed Death Nova with Inarius set for melee range devastating damage.", playstyle: "caster" },
    { name: "Trag'Oul Death Nova Necromancer", className: "Necromancer", guideUrl: "https://maxroll.gg/d3/build-guides/tragoul-death-nova", description: "Health-fueled Death Nova using Trag'Oul set for blood magic scaling.", playstyle: "caster" },
    { name: "LoD Bone Spear Necromancer", className: "Necromancer", guideUrl: "https://maxroll.gg/d3/build-guides/lod-bone-spear", description: "Bone Spear with Legacy of Dreams for insane single-target boss damage.", playstyle: "caster" },
    { name: "LoD Meteor Wizard", className: "Wizard", guideUrl: "https://maxroll.gg/d3/build-guides/lod-meteor-wizard", description: "Buffed meteor crashing in massive explosions with Legacy of Dreams for free gear.", playstyle: "caster" },
    { name: "Firebird Meteor Wizard", className: "Wizard", guideUrl: "https://maxroll.gg/d3/build-guides/firebird-meteor-wizard", description: "Firebird set Meteor Wizard with fire damage ramping after consecutive meteor hits.", playstyle: "caster" },
    { name: "Tal Rasha Meteor Wizard", className: "Wizard", guideUrl: "https://maxroll.gg/d3/build-guides/tal-rasha-meteor-wizard", description: "Four-element Tal Rasha set with Meteor stacking elemental damage bonuses.", playstyle: "caster" },
    { name: "Akkhan Condemn Crusader", className: "Crusader", guideUrl: "https://maxroll.gg/d3/build-guides/akkhan-condemn-crusader", description: "Holy damage Crusader using Condemn explosions from the Akkhan set.", playstyle: "melee" },
    { name: "Natalya Spike Trap Demon Hunter", className: "Demon Hunter", guideUrl: "https://maxroll.gg/d3/build-guides/natalya-spike-trap", description: "Natalya's set Demon Hunter placing Spike Traps that devastate elites instantly.", playstyle: "ranged" },
    { name: "Marauder Sentry Demon Hunter", className: "Demon Hunter", guideUrl: "https://maxroll.gg/d3/build-guides/marauder-sentry", description: "Classic turret Demon Hunter with Marauder set and six simultaneous sentries.", playstyle: "ranged" },
    { name: "LoD HotA Barbarian", className: "Barbarian", guideUrl: "https://maxroll.gg/d3/build-guides/lod-hota-barbarian", description: "Hammer of the Ancients Legacy of Dreams Barbarian dealing devastating blows.", playstyle: "melee" },
    { name: "Raekor Boulder Toss Barbarian", className: "Barbarian", guideUrl: "https://maxroll.gg/d3/build-guides/raekor-boulder-toss", description: "Ancient Spear Boulder Toss Barbarian with Raekor set charge mechanics.", playstyle: "melee" },
    { name: "Blessed Shield Crusader", className: "Crusader", guideUrl: "https://maxroll.gg/d3/build-guides/blessed-shield-crusader", description: "Shield-throwing Crusader with massive ricochet damage from Blessed Shield.", playstyle: "melee" },
    { name: "POJ Tempest Rush Monk", className: "Monk", guideUrl: "https://maxroll.gg/d3/build-guides/poj-tempest-rush-monk", description: "Patterns of Justice set Monk sprinting through enemies with Tempest Rush.", playstyle: "melee" },
  ];
  for (let i = 0; i < d3Builds.length; i++) {
    const b = d3Builds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: d3Id, gameModeId: d3DefaultMode.id, seasonId: d3S38.id,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Grim Dawn (15 builds) ─
  const gdDefaultMode = createdModes["grim-dawn"]["softcore"];
  const gdBuilds = [
    { name: "Dawnbreaker Warder", className: "Warder (Soldier + Shaman)", guideUrl: "https://forums.crateentertainment.com/t/warder-dawnbreaker/100001", description: "Physical damage Warder with Dawnbreaker set and exceptional survivability.", playstyle: "melee" },
    { name: "Brutallax Dervish", className: "Dervish (Oathkeeper + Nightblade)", guideUrl: "https://www.grimtools.com/calc/brutallax-dervish", description: "Dual-wielding Dervish with Zolhan's Technique for tremendous physical DPS.", playstyle: "melee" },
    { name: "Chillwhisper Reaper", className: "Reaper (Nightblade + Necromancer)", guideUrl: "https://www.grimtools.com/calc/chillwhisper-reaper", description: "Cold damage Reaper with Chillwhisper set and huge crowd control.", playstyle: "melee" },
    { name: "Pierce RoS Blademaster", className: "Blademaster (Soldier + Nightblade)", guideUrl: "https://forums.crateentertainment.com/t/blademaster-pierce-ros/100002", description: "Ring of Steel Blademaster with full pierce damage for unrivaled boss melting.", playstyle: "melee" },
    { name: "Hellborne Shieldbreaker", className: "Shieldbreaker (Demolitionist + Oathkeeper)", guideUrl: "https://forums.crateentertainment.com/t/shieldbreaker-hellborne/100003", description: "Fire damage Shieldbreaker with Hellborne set and Grenado/Firestrike synergies.", playstyle: "caster" },
    { name: "Voidsoul Sentinel", className: "Sentinel (Inquisitor + Shaman)", guideUrl: "https://www.grimtools.com/calc/voidsoul-sentinel", description: "Dual elemental and void Sentinel with Rune of Hagarrad and Trozan's Sky Shard.", playstyle: "caster" },
    { name: "Deathguard Reaper", className: "Reaper (Nightblade + Necromancer)", guideUrl: "https://forums.crateentertainment.com/t/reaper-deathguard/100004", description: "Bleeding and poison Reaper using Deathguard set for DoT-stacking excellence.", playstyle: "melee" },
    { name: "Chaos Skeletons Cabalist", className: "Cabalist (Occultist + Arcanist)", guideUrl: "https://forums.crateentertainment.com/t/cabalist-chaos-skeleton/100005", description: "Chaos-damage summoner Cabalist with an army of corrupted skeleton warriors.", playstyle: "summoner" },
    { name: "Pierce PB Witch Hunter", className: "Witch Hunter (Inquisitor + Nightblade)", guideUrl: "https://forums.crateentertainment.com/t/witch-hunter-pierce-pb/100006", description: "Pneumatic Burst-buffed pierce Witch Hunter with inquisitor seals.", playstyle: "melee" },
    { name: "Rotgheist DEE Conjurer", className: "Conjurer (Occultist + Shaman)", guideUrl: "https://www.grimtools.com/calc/rotgheist-dee-conjurer", description: "Defiler's End Explosion Conjurer with massive poison cloud from Rotgheist set.", playstyle: "caster" },
    { name: "FoI RtA Purifier", className: "Purifier (Demolitionist + Inquisitor)", guideUrl: "https://forums.crateentertainment.com/t/purifier-foi-rta/100007", description: "Flames of Ignaffar Purifier with Rune of Torment/Amatok combo.", playstyle: "ranged" },
    { name: "Demonslayer Reaper", className: "Reaper (Nightblade + Necromancer)", guideUrl: "https://forums.crateentertainment.com/t/reaper-demonslayer/100008", description: "Cold and Vitality Reaper with Demonslayer set for swift assassination.", playstyle: "melee" },
    { name: "Vitality Skeletons Ritualist", className: "Ritualist (Occultist + Shaman)", guideUrl: "https://forums.crateentertainment.com/t/ritualist-vitality-skeleton/100009", description: "Vitality skeleton army Ritualist with Living Shadow for permanent minion healing.", playstyle: "summoner" },
    { name: "Blightlord DE Oppressor", className: "Oppressor (Occultist + Inquisitor)", guideUrl: "https://forums.crateentertainment.com/t/oppressor-blightlord/100010", description: "Dark Energy Oppressor with Blightlord set for chaos/vitality hybrid damage.", playstyle: "caster" },
    { name: "Vitality Spam Sigils Conjurer", className: "Conjurer (Occultist + Shaman)", guideUrl: "https://forums.crateentertainment.com/t/conjurer-vitality-sigils/100011", description: "Sigils of Consumption spamming Conjurer with totem-amplified vitality damage.", playstyle: "caster" },
  ];
  for (let i = 0; i < gdBuilds.length; i++) {
    const b = gdBuilds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: gdId, gameModeId: gdDefaultMode.id, seasonId: null,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Torchlight Infinite (15 builds) ─
  const tlDefaultMode = createdModes["torchlight-infinite"]["softcore"];
  const tlBuilds = [
    { name: "Lightning Projectile Erica", className: "Erica", guideUrl: "https://www.youtube.com/watch?v=tl_erica_lightning", description: "Chain lightning projectile Erica with massive clear speed in SS11.", playstyle: "ranged" },
    { name: "Flicker Strike Erica", className: "Erica", guideUrl: "https://www.youtube.com/watch?v=tl_erica_flicker", description: "Teleporting melee Erica with Flicker Strike-style rapid repositioning.", playstyle: "melee" },
    { name: "Rage Melee Rehan", className: "Rehan", guideUrl: "https://maxroll.gg/torchlight-infinite/build-guides/rehan-rage", description: "Berserk warrior Rehan that gets stronger as rage stacks accumulate.", playstyle: "melee" },
    { name: "Minion Iris", className: "Iris", guideUrl: "https://maxroll.gg/torchlight-infinite/build-guides/iris-minion", description: "Summoner Iris with control minions providing excellent passive clear.", playstyle: "summoner" },
    { name: "Autobomber Gemma", className: "Gemma", guideUrl: "https://www.youtube.com/watch?v=tl_gemma_autobomber", description: "Self-detonating loop Gemma with explosions chaining through enemy packs.", playstyle: "caster" },
    { name: "Caster Youga", className: "Youga", guideUrl: "https://maxroll.gg/torchlight-infinite/build-guides/youga-caster", description: "Elemental caster Youga with multiple spell types for flexible content coverage.", playstyle: "caster" },
    { name: "Projectile Rosa", className: "Rosa", guideUrl: "https://www.youtube.com/watch?v=tl_rosa_projectile", description: "High-speed projectile spam Rosa with mechanical turret assistance.", playstyle: "ranged" },
    { name: "Explosive Bing", className: "Bing", guideUrl: "https://maxroll.gg/torchlight-infinite/build-guides/bing-explosive", description: "Grenade-based Bing with area saturation from overlapping explosive radius.", playstyle: "ranged" },
    { name: "Thea Deathless", className: "Thea", guideUrl: "https://www.youtube.com/watch?v=tl_thea_deathless", description: "Immortality-geared Thea with permanent buff stacking and near-infinite sustain.", playstyle: "hybrid" },
    { name: "Mind Control Youga", className: "Youga", guideUrl: "https://www.youtube.com/watch?v=tl_youga_mindcontrol", description: "Crowd-controlling Youga that turns elite enemies into temporary allies.", playstyle: "summoner" },
    { name: "Split Shot Erica", className: "Erica", guideUrl: "https://www.youtube.com/watch?v=tl_erica_splitshot", description: "Multi-arrow Erica build with projectile splitting for exceptional pack clear.", playstyle: "ranged" },
    { name: "Rehan Rage Barbarian", className: "Rehan", guideUrl: "https://maxroll.gg/torchlight-infinite/build-guides/rehan-barbarian", description: "Unstoppable Rehan brawler using Rage as the resource for maximum attacks.", playstyle: "melee" },
    { name: "Dual Element Gemma", className: "Gemma", guideUrl: "https://maxroll.gg/torchlight-infinite/build-guides/gemma-dual-element", description: "Two-element hybrid Gemma cycling fire and cold for maximum uptime damage.", playstyle: "caster" },
    { name: "Glass Cannon Karano", className: "Karano", guideUrl: "https://maxroll.gg/torchlight-infinite/build-guides/karano-glass-cannon", description: "Maximum damage output Karano with zero defense — one-shot everything or die.", playstyle: "caster" },
    { name: "Mobility Erica", className: "Erica", guideUrl: "https://maxroll.gg/torchlight-infinite/build-guides/erica-mobility", description: "Speed-focused Erica maximizing movement abilities and hit-and-run attacks.", playstyle: "ranged" },
  ];
  for (let i = 0; i < tlBuilds.length; i++) {
    const b = tlBuilds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: tlId, gameModeId: tlDefaultMode.id, seasonId: tlSS11.id,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Destiny 2 (15 builds) ─
  const d2DefaultMode = createdModes["destiny-2"]["pve"];
  const dest2Builds = [
    { name: "Contraverse Hold Void Warlock", className: "Warlock", guideUrl: "https://mobalytics.gg/destiny-2/builds/warlock-contraverse-void", description: "Literally broken Contraverse Hold Void Warlock — grenade uptime is perpetual.", playstyle: "caster" },
    { name: "GREATEST Solar Titan Build", className: "Titan", guideUrl: "https://mobalytics.gg/destiny-2/builds/titan-solar", description: "Sunbreaker Titan with maximum Solar power and Hammer of Sol uptime.", playstyle: "melee" },
    { name: "Shadow Hunter Void", className: "Hunter", guideUrl: "https://mobalytics.gg/destiny-2/builds/hunter-void-shadow", description: "Void Hunter that Vanishes into shadow for devastating ambush attacks.", playstyle: "melee" },
    { name: "Praxic Blade Void Titan", className: "Titan", guideUrl: "https://mobalytics.gg/destiny-2/builds/titan-praxic-blade-void", description: "CRAZY Titan blade build using Praxic Fire and Void overshield for nuclear damage.", playstyle: "melee" },
    { name: "Nuclear Storm Titan", className: "Titan", guideUrl: "https://mobalytics.gg/destiny-2/builds/titan-nuclear-storm", description: "Arc Titan with thundercrash and lightning strikes providing storm coverage.", playstyle: "melee" },
    { name: "Lucky Raspberry Infinite Hunter", className: "Hunter", guideUrl: "https://mobalytics.gg/destiny-2/builds/hunter-lucky-raspberry", description: "Infinite Arcbolt Grenade spam Hunter — the most fun Arc build in the game.", playstyle: "ranged" },
    { name: "Winter's Surge Stasis Warlock", className: "Warlock", guideUrl: "https://mobalytics.gg/destiny-2/builds/warlock-stasis-surge", description: "Stasis Warlock with Winter's Guile freezing everything within reach.", playstyle: "caster" },
    { name: "Blinding Blade Arc Warlock", className: "Warlock", guideUrl: "https://mobalytics.gg/destiny-2/builds/warlock-blinding-blade-arc", description: "Arclock build with Blinding Grenades and chain lightning buffing entire team.", playstyle: "caster" },
    { name: "Void Ursa DPS Support Titan", className: "Titan", guideUrl: "https://mobalytics.gg/destiny-2/builds/titan-void-ursa-support", description: "Bubble-providing support Titan that also deals excellent Void damage.", playstyle: "hybrid" },
    { name: "OP Stormdancer Warlock", className: "Warlock", guideUrl: "https://mobalytics.gg/destiny-2/builds/warlock-stormdancer", description: "Stormtrance Warlock reaching astronomical damage with Stormdancer's Brace.", playstyle: "caster" },
    { name: "Infinite Supers Lawless Hunter", className: "Hunter", guideUrl: "https://www.youtube.com/watch?v=d2_lawless_hunter", description: "Season of Lawless Hunter with infinite super generation for constant Golden Gun.", playstyle: "ranged" },
    { name: "God Mode Praxic Blade Titan", className: "Titan", guideUrl: "https://www.youtube.com/watch?v=d2_titan_praxic_god", description: "Unkillable Titan with max restoration and Praxic Fire for endgame content.", playstyle: "melee" },
    { name: "Mothkeeper Strand Hunter", className: "Hunter", guideUrl: "https://www.youtube.com/watch?v=d2_mothkeeper_hunter", description: "Strand Hunter using Mothkeeper Wraps for explosive grenade proliferation.", playstyle: "ranged" },
    { name: "Delicate Tomb Arc Warlock", className: "Warlock", guideUrl: "https://www.youtube.com/watch?v=d2_delicate_tomb", description: "Delicate Tomb exotic Arc Warlock with Ionic Trace synergies and ability spam.", playstyle: "caster" },
    { name: "Hammer Throw Solar Titan", className: "Titan", guideUrl: "https://www.youtube.com/watch?v=d2_hammer_solar_titan", description: "Sunbreaker Titan hurling solar hammers with incandescent explosions on every kill.", playstyle: "melee" },
  ];
  for (let i = 0; i < dest2Builds.length; i++) {
    const b = dest2Builds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: d2Id, gameModeId: d2DefaultMode.id, seasonId: d2SeasonLawless.id,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Borderlands 3 (15 builds) ─
  const bl3DefaultMode = createdModes["borderlands-3"]["pve"];
  const bl3Builds = [
    { name: "Mozerker 8.0 Moze", className: "Moze", guideUrl: "https://www.youtube.com/watch?v=bl3_mozerker", description: "The legendary Mozerker build with infinite grenades and Iron Bear for Moze.", playstyle: "hybrid" },
    { name: "Khaos Queen Amara", className: "Amara", guideUrl: "https://www.lootlemon.com/class/siren", description: "Amara Phasecast build for insane elemental damage output and survivability.", playstyle: "melee" },
    { name: "Nuclear Revolt Zane", className: "Zane", guideUrl: "https://www.lootlemon.com/class/operative", description: "Zane with nuclear damage stacking from Double Barrel and MNTIS shoulder cannon.", playstyle: "ranged" },
    { name: "Rakk Attack FL4K", className: "FL4K", guideUrl: "https://www.lootlemon.com/class/beastmaster", description: "Perpetual Rakk Attack spam FL4K with Gamma Burst synergies.", playstyle: "ranged" },
    { name: "Iron Maiden Moze", className: "Moze", guideUrl: "https://www.lootlemon.com/class/gunner", description: "Iron Bear tank Moze that stays in mech permanently with unlimited fuel.", playstyle: "hybrid" },
    { name: "Fettuccine FL4K", className: "FL4K", guideUrl: "https://www.lootlemon.com/class/beastmaster", description: "Crit-stacking FL4K with Fade Away for consistent one-shotting of all content.", playstyle: "ranged" },
    { name: "Fade Away Crit FL4K", className: "FL4K", guideUrl: "https://www.youtube.com/watch?v=bl3_fl4k_fade_away", description: "Critical hit FL4K that uses Fade Away as the primary damage multiplier.", playstyle: "ranged" },
    { name: "Immortal Snowshoe Moze", className: "Moze", guideUrl: "https://www.youtube.com/watch?v=bl3_moze_immortal", description: "Unkillable Moze with Snowshoe shield and constant health regeneration.", playstyle: "hybrid" },
    { name: "Mortal Snowshoe Moze", className: "Moze", guideUrl: "https://www.youtube.com/watch?v=bl3_moze_mortal", description: "Glass cannon Snowshoe Moze maximizing grenade damage at the cost of all defense.", playstyle: "ranged" },
    { name: "Stackbot Punch Moze", className: "Moze", guideUrl: "https://www.youtube.com/watch?v=bl3_moze_stackbot", description: "Action Skill punch Moze with Stackbot artifact for stacking unlimited bonuses.", playstyle: "melee" },
    { name: "Mantis Cannon Zane", className: "Zane", guideUrl: "https://www.youtube.com/watch?v=bl3_zane_mantis", description: "Mantis Cannon Zane with clone and drone for unique three-body fighting style.", playstyle: "hybrid" },
    { name: "Phasecast Amara", className: "Amara", guideUrl: "https://www.youtube.com/watch?v=bl3_amara_phasecast", description: "Phasecast Amara dealing massive upfront spiritual damage on command.", playstyle: "caster" },
    { name: "Digi-Clone Infinite Zane", className: "Zane", guideUrl: "https://www.youtube.com/watch?v=bl3_zane_digi", description: "Infinite clone cycling Zane that swaps places with his clone for constant buffs.", playstyle: "hybrid" },
    { name: "Gamma Burst Pet FL4K", className: "FL4K", guideUrl: "https://www.lootlemon.com/class/beastmaster", description: "FL4K's Pet takes center stage with Gamma Burst radiation explosions on kills.", playstyle: "summoner" },
    { name: "Grenadier Moze", className: "Moze", guideUrl: "https://www.lootlemon.com/class/gunner", description: "Infinite grenade Moze throwing explosives with no magazine cost constantly.", playstyle: "ranged" },
  ];
  for (let i = 0; i < bl3Builds.length; i++) {
    const b = bl3Builds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: bl3Id, gameModeId: bl3DefaultMode.id, seasonId: null,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Borderlands 4 (15 builds) ─
  const bl4DefaultMode = createdModes["borderlands-4"]["standard"];
  const bl4Builds = [
    { name: "Dead Ringer Minion Vex", className: "Vex the Siren", guideUrl: "https://game8.co/games/borderlands-4/archives/vex-dead-ringer-build", description: "Vex summons Dead Ringer minions that replicate her spells for double damage.", playstyle: "summoner" },
    { name: "Incarnate Bleed Vex", className: "Vex the Siren", guideUrl: "https://game8.co/games/borderlands-4/archives/vex-bleed-build", description: "Vex causes Incandescence bleed effects that stack for massive DoT scaling.", playstyle: "caster" },
    { name: "Peacebreaker Ricochet Rafa", className: "Rafa the Exo-Soldier", guideUrl: "https://game8.co/games/borderlands-4/archives/rafa-peacebreaker", description: "Rafa's Peacebreaker rounds ricochet off walls and enemies for surprising damage.", playstyle: "ranged" },
    { name: "Peacebreaker Overdrive Rafa", className: "Rafa the Exo-Soldier", guideUrl: "https://game8.co/games/borderlands-4/archives/rafa-overdrive", description: "Overdrive mode Rafa activating Peacebreaker for turbo attack speed and damage.", playstyle: "ranged" },
    { name: "Scourge Cryo Amon", className: "Amon the Forgeknight", guideUrl: "https://game8.co/games/borderlands-4/archives/amon-cryo-scourge", description: "Amon cryo forging — Scourge ability freezes clusters of enemies solid.", playstyle: "melee" },
    { name: "Calamity Incendiary Amon", className: "Amon the Forgeknight", guideUrl: "https://game8.co/games/borderlands-4/archives/amon-incendiary", description: "Calamity Amon with forge-heat incendiary damage amplification on all weapons.", playstyle: "melee" },
    { name: "Flux Generator Harlowe", className: "Harlowe the Gravitar", guideUrl: "https://game8.co/games/borderlands-4/archives/harlowe-flux", description: "Gravity Flux Generator Harlowe suspending enemies for critical vulnerability.", playstyle: "caster" },
    { name: "CHROMA Status Harlowe", className: "Harlowe the Gravitar", guideUrl: "https://game8.co/games/borderlands-4/archives/harlowe-chroma", description: "CHROMA ability Harlowe applying all status effects simultaneously for maxed procs.", playstyle: "caster" },
    { name: "Shock Spear Wrathfall Amon", className: "Amon the Forgeknight", guideUrl: "https://www.youtube.com/watch?v=bl4_amon_shock", description: "Electric spear Amon with Wrathfall meteor calling for devastating ground zeroes.", playstyle: "melee" },
    { name: "Gunboy Card Totem C4SH", className: "C4SH the Rogue", guideUrl: "https://mobalytics.gg/borderlands-4/builds/c4sh-gunboy-card-totem", description: "C4SH drops card totems that summon GUNBOY turrets for automated slaughter.", playstyle: "summoner" },
    { name: "CR4SH No-Reload C4SH", className: "C4SH the Rogue", guideUrl: "https://mobalytics.gg/borderlands-4/builds/c4sh-no-reload", description: "Infinite magazine C4SH build that never needs to reload — just infinite fire.", playstyle: "ranged" },
    { name: "Infini-Crit Harlowe", className: "Harlowe the Gravitar", guideUrl: "https://www.youtube.com/watch?v=bl4_harlowe_crit", description: "Critical hit stacking Harlowe with gravity manipulation exposing weak points.", playstyle: "ranged" },
    { name: "Ultimate Crit Vex", className: "Vex the Siren", guideUrl: "https://www.youtube.com/watch?v=bl4_vex_ultimate_crit", description: "Maximum critical hit Vex using Siren powers to expose enemy critical points.", playstyle: "caster" },
    { name: "Incendiary Slugger Amon", className: "Amon the Forgeknight", guideUrl: "https://www.youtube.com/watch?v=bl4_amon_slugger", description: "Heavy melee Amon with Forgeknight amplification turning all strikes incendiary.", playstyle: "melee" },
    { name: "GUNBOY Totem C4SH", className: "C4SH the Rogue", guideUrl: "https://www.youtube.com/watch?v=bl4_c4sh_gunboy_totem", description: "C4SH's signature GUNBOY card summoning — let the totem do all the work.", playstyle: "summoner" },
  ];
  for (let i = 0; i < bl4Builds.length; i++) {
    const b = bl4Builds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: bl4Id, gameModeId: bl4DefaultMode.id, seasonId: null,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Fallout 4 (15 builds) ─
  const fo4DefaultMode = createdModes["fallout-4"]["normal"];
  const fo4Builds = [
    { name: "Stealth Sniper", className: "Rifleman", guideUrl: "https://www.hacktheminotaur.com/fallout-4-sniper-build", description: "Maximum sneak Sniper with scoped rifles and one-shot potential from stealth.", playstyle: "ranged" },
    { name: "Melee Brawler", className: "Melee", guideUrl: "https://www.hacktheminotaur.com/fallout-4-melee-build", description: "High STR melee fighter using Power Fist and Blitz for teleport-kill combos.", playstyle: "melee" },
    { name: "Settlement Commander", className: "Diplomat", guideUrl: "https://www.hacktheminotaur.com/fallout-4-settlement-build", description: "Charisma and settlement management build for resource empire building.", playstyle: "hybrid" },
    { name: "Explosives Expert", className: "Heavy Weapons", guideUrl: "https://www.hacktheminotaur.com/fallout-4-explosives-build", description: "Demolition Expert perks for throwing grenades and mines at everything.", playstyle: "ranged" },
    { name: "Gunslinger", className: "Pistol", guideUrl: "https://www.hacktheminotaur.com/fallout-4-pistol-build", description: "Nimble Gunslinger with powerful pistols and maximum VATS accuracy.", playstyle: "ranged" },
    { name: "Power Armor Heavy", className: "Heavy", guideUrl: "https://www.hacktheminotaur.com/fallout-4-power-armor-build", description: "Minigun-toting Power Armor warrior who ignores all damage entirely.", playstyle: "melee" },
    { name: "Luck VATS Commando", className: "Automatic", guideUrl: "https://www.hacktheminotaur.com/fallout-4-vats-build", description: "Maximum Luck VATS build with automatic weapons and critical hit cycling.", playstyle: "ranged" },
    { name: "Rifleman Marksman", className: "Rifle", guideUrl: "https://www.hacktheminotaur.com/fallout-4-rifleman-build", description: "Long-range Rifleman with Commando perks for scoped rifle excellence.", playstyle: "ranged" },
    { name: "Stealth Melee Ninja", className: "Melee", guideUrl: "https://www.hacktheminotaur.com/fallout-4-ninja-build", description: "Invisible melee killer combining Sneak Attack with bladed weapon multipliers.", playstyle: "melee" },
    { name: "Sniper Headshot Specialist", className: "Sniper", guideUrl: "https://www.hacktheminotaur.com/fallout-4-sniper-specialist", description: "Specialized headshot precision sniper taking out enemies from maximum range.", playstyle: "ranged" },
    { name: "Unarmed Brawler", className: "Unarmed", guideUrl: "https://www.hacktheminotaur.com/fallout-4-unarmed-build", description: "Iron Fist maxed unarmed build dealing incredible bare-knuckle devastation.", playstyle: "melee" },
    { name: "Charisma Diplomat", className: "Speech", guideUrl: "https://www.hacktheminotaur.com/fallout-4-charisma-build", description: "Maximum charisma build for persuading, intimidating, and pacifying enemies.", playstyle: "hybrid" },
    { name: "Spray n Pray Commando", className: "Automatic", guideUrl: "https://www.reddit.com/r/fo4/comments/best_commando_build", description: "Automatic weapon specialist using Spray n Pray for explosive rounds on everything.", playstyle: "ranged" },
    { name: "VATS Tactician", className: "VATS", guideUrl: "https://www.hacktheminotaur.com/fallout-4-vats-tactics", description: "VATS chaining specialist cycling through critical hits perpetually in slow motion.", playstyle: "ranged" },
    { name: "Nuke Launcher", className: "Heavy Weapons", guideUrl: "https://www.hacktheminotaur.com/fallout-4-heavy-weapons-build", description: "Demolitions expert with Fat Man and Missile Launcher for room-clearing explosions.", playstyle: "ranged" },
  ];
  for (let i = 0; i < fo4Builds.length; i++) {
    const b = fo4Builds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: fo4Id, gameModeId: fo4DefaultMode.id, seasonId: null,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }

  // ─ Crimson Desert (15 builds) ─
  const cdDefaultMode = createdModes["crimson-desert"]["pve"];
  const cdBuilds = [
    { name: "Savage Samurai Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_samurai", description: "Katana-wielding Kliff with blazing fast attacks and lethal samurai combos.", playstyle: "melee" },
    { name: "Unga Bunga Behemoth Oongka", className: "Oongka", guideUrl: "https://www.youtube.com/watch?v=cd_oongka_behemoth", description: "Oongka wielding a massive club and hitting everything with overwhelming brute force.", playstyle: "melee" },
    { name: "Supernatural Melee Monk Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_monk", description: "Martial arts Kliff with supernatural speed and precision combo attacks.", playstyle: "melee" },
    { name: "Dual Fireworks Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_fireworks", description: "Twin-wielding explosive Kliff creating firework-like detonations with each strike.", playstyle: "ranged" },
    { name: "Critical Cannon Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_cannon", description: "High critical rate Kliff with cannon-like power on charged attacks.", playstyle: "ranged" },
    { name: "Boss Slayer Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_boss_slayer", description: "Specialized boss killing Kliff with focused burst damage windows.", playstyle: "melee" },
    { name: "Lightning Mecha Spear Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_lightning_spear", description: "Electric spear Kliff channeling lightning through each mechanical thrust.", playstyle: "melee" },
    { name: "Shaman 2-Hander Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_shaman", description: "Spiritual two-handed Kliff drawing power from shamanic connection to elements.", playstyle: "melee" },
    { name: "Thunder Witch Lightning Orbs Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_thunder_witch", description: "Ranged lightning orb Kliff with thunderous detonations on impact.", playstyle: "caster" },
    { name: "Kinetic Burst Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_kinetic", description: "Kinetic energy releasing Kliff with charged burst attacks for mass stagger.", playstyle: "melee" },
    { name: "Purple Magic Fist Kliff", className: "Kliff", guideUrl: "https://www.youtube.com/watch?v=cd_kliff_purple_fist", description: "Dark magic-channeling Kliff punching with supernatural purple energy fists.", playstyle: "melee" },
    { name: "Raging Lightning Oongka", className: "Oongka", guideUrl: "https://www.youtube.com/watch?v=cd_oongka_lightning", description: "Oongka calling lightning storms from the sky while charging enemies.", playstyle: "caster" },
    { name: "Elemental Blade Kliff", className: "Kliff", guideUrl: "https://www.lootlemon.com/crimson-desert/kliff", description: "Multi-element blade Kliff cycling fire, ice, and lightning for maximum versatility.", playstyle: "melee" },
    { name: "Abyssal Lich Spear Kliff", className: "Kliff", guideUrl: "https://www.lootlemon.com/crimson-desert/kliff-abyssal", description: "Dark abyssal energy spear Kliff with lifesteal and undead summoning synergies.", playstyle: "melee" },
    { name: "Optimal Crit Spear Kliff", className: "Kliff", guideUrl: "https://www.reddit.com/r/CrimsonDesert/comments/kliff_crit_spear", description: "Maximum critical rate spear build optimized for consistent one-shot potential.", playstyle: "ranged" },
  ];
  for (let i = 0; i < cdBuilds.length; i++) {
    const b = cdBuilds[i];
    const up = 200 + Math.floor(Math.random() * 300);
    const down = Math.floor(up * 0.07);
    const user = getUser(i);
    const created = storage.createBuild({
      gameId: cdId, gameModeId: cdDefaultMode.id, seasonId: null,
      name: b.name, className: b.className, mastery: "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: user.id, gameClassId: null, anonHash: null,
    });
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }
}

// ─── Routes ────────────────────────────────────────────────────

export async function registerRoutes(server: Server, app: Express) {
  initDB();

  // ── Games ──

  app.get("/api/games", (_req, res) => {
    const allGames = storage.getGames();
    const result = allGames.map(g => {
      const classes = storage.getGameClasses(g.id);
      const activeSeasons = storage.getSeasonsByGame(g.id).filter(s => s.isActive);
      const modes = storage.getGameModes(g.id);
      const buildCount = (db.all(sql`SELECT count(*) as c FROM builds WHERE game_id = ${g.id}`) as any[])[0]?.c ?? 0;
      return { ...g, classes, activeSeasons, modes, buildCount };
    });
    res.json(result);
  });

  app.get("/api/games/:slug", (req, res) => {
    const game = storage.getGameBySlug(req.params.slug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    const classes = storage.getGameClasses(game.id);
    const activeSeasons = storage.getSeasonsByGame(game.id).filter(s => s.isActive);
    const modes = storage.getGameModes(game.id);
    const buildCount = (db.all(sql`SELECT count(*) as c FROM builds WHERE game_id = ${game.id}`) as any[])[0]?.c ?? 0;
    res.json({ ...game, classes, activeSeasons, modes, buildCount });
  });

  app.post("/api/games", (req, res) => {
    const { adminUserId, ...gameData } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const parsed = insertGameSchema.safeParse(gameData);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    res.status(201).json(storage.createGame(parsed.data));
  });

  app.patch("/api/games/:id", (req, res) => {
    const { adminUserId, ...data } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateGame(parseInt(req.params.id), data);
    if (!updated) return res.status(404).json({ error: "Game not found" });
    res.json(updated);
  });

  app.delete("/api/games/:id", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteGame(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Game Modes ──

  app.get("/api/games/:gameSlug/modes", (req, res) => {
    const game = storage.getGameBySlug(req.params.gameSlug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json(storage.getGameModes(game.id));
  });

  app.post("/api/games/:gameSlug/modes", (req, res) => {
    const { adminUserId, ...modeData } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const game = storage.getGameBySlug(req.params.gameSlug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    const parsed = insertGameModeSchema.safeParse({ ...modeData, gameId: game.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    res.status(201).json(storage.createGameMode(parsed.data));
  });

  app.patch("/api/game-modes/:id", (req, res) => {
    const { adminUserId, ...data } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateGameMode(parseInt(req.params.id), data);
    if (!updated) return res.status(404).json({ error: "Game mode not found" });
    res.json(updated);
  });

  app.delete("/api/game-modes/:id", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteGameMode(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Game Classes ──

  app.get("/api/games/:gameSlug/classes", (req, res) => {
    const game = storage.getGameBySlug(req.params.gameSlug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json(storage.getGameClasses(game.id));
  });

  app.post("/api/games/:gameSlug/classes", (req, res) => {
    const { adminUserId, ...classData } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const game = storage.getGameBySlug(req.params.gameSlug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    const parsed = insertGameClassSchema.safeParse({ ...classData, gameId: game.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    res.status(201).json(storage.createGameClass(parsed.data));
  });

  app.patch("/api/game-classes/:id", (req, res) => {
    const { adminUserId, ...data } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateGameClass(parseInt(req.params.id), data);
    if (!updated) return res.status(404).json({ error: "Class not found" });
    res.json(updated);
  });

  app.delete("/api/game-classes/:id", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteGameClass(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Seasons ──

  app.get("/api/seasons", (_req, res) => {
    res.json(storage.getSeasons());
  });

  app.get("/api/games/:gameSlug/seasons", (req, res) => {
    const game = storage.getGameBySlug(req.params.gameSlug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json(storage.getSeasonsByGame(game.id));
  });

  app.post("/api/seasons", (req, res) => {
    const { adminUserId, ...seasonData } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const parsed = insertSeasonSchema.safeParse(seasonData);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    res.status(201).json(storage.createSeason(parsed.data));
  });

  app.patch("/api/seasons/:id", (req, res) => {
    const { adminUserId, ...data } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateSeason(parseInt(req.params.id), data);
    if (!updated) return res.status(404).json({ error: "Season not found" });
    res.json(updated);
  });

  app.delete("/api/seasons/:id", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteSeason(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Builds ──

  app.get("/api/games/:gameSlug/builds", (req, res) => {
    const game = storage.getGameBySlug(req.params.gameSlug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    const { seasonId, gameModeId, className, mastery } = req.query;
    res.json(storage.getBuilds({
      gameId: game.id,
      seasonId: seasonId ? parseInt(seasonId as string) : undefined,
      gameModeId: gameModeId ? parseInt(gameModeId as string) : undefined,
      className: className as string | undefined,
      mastery: mastery as string | undefined,
    }));
  });

  app.get("/api/games/:gameSlug/tier-list", (req, res) => {
    const game = storage.getGameBySlug(req.params.gameSlug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    const { seasonId, gameModeId } = req.query;
    const allBuilds = storage.getBuilds({
      gameId: game.id,
      seasonId: seasonId ? parseInt(seasonId as string) : undefined,
      gameModeId: gameModeId ? parseInt(gameModeId as string) : undefined,
    });
    res.json(buildTierList(allBuilds));
  });

  // Legacy tier-list (for backwards compatibility)
  app.get("/api/tier-list", (req, res) => {
    const { seasonId, gameModeId, gameSlug } = req.query;
    let gameId: number | undefined;
    if (gameSlug) {
      const g = storage.getGameBySlug(gameSlug as string);
      gameId = g?.id;
    }
    const allBuilds = storage.getBuilds({
      gameId,
      seasonId: seasonId ? parseInt(seasonId as string) : undefined,
      gameModeId: gameModeId ? parseInt(gameModeId as string) : undefined,
    });
    res.json(buildTierList(allBuilds));
  });

  app.get("/api/builds/:id", (req, res) => {
    const build = storage.getBuild(parseInt(req.params.id));
    if (!build) return res.status(404).json({ error: "Build not found" });
    res.json(build);
  });

  app.post("/api/builds", (req, res) => {
    const voterHash = getVoterHash(req, res);
    let submitterId = req.body.submitterId;
    let isAnon = false;

    if (!submitterId) {
      let anon = storage.getUserByUsername("Anonymous");
      if (!anon) anon = storage.createUser({ username: "Anonymous", passwordHash: "nologin" });
      submitterId = anon.id;
      isAnon = true;
    } else {
      const user = storage.getUserById(submitterId);
      if (!user) return res.status(400).json({ error: "Invalid submitter" });
    }

    // Validate gameId
    const gameId = req.body.gameId;
    if (!gameId) return res.status(400).json({ error: "gameId is required" });
    const game = storage.getGame(gameId);
    if (!game) return res.status(400).json({ error: "Invalid game" });

    const parsed = insertBuildSchema.safeParse({ ...req.body, submitterId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

    const build = storage.createBuild(parsed.data);

    if (isAnon) {
      db.run(sql`UPDATE builds SET anon_hash = ${voterHash} WHERE id = ${build.id}`);
    }

    // Auto-generate social posts for all 4 platforms
    try {
      const enrichedBuild = storage.getBuild(build.id);
      if (enrichedBuild) {
        const gameName = enrichedBuild.gameName || game.name;
        const tier = getTierFromScore(enrichedBuild.upvotes, enrichedBuild.downvotes);
        const socialPostsData = generateSocialPosts(enrichedBuild, gameName, tier);
        for (const sp of socialPostsData) {
          storage.createSocialPost({
            buildId: build.id,
            gameId: build.gameId,
            platform: sp.platform,
            content: sp.content,
            hashtags: sp.hashtags,
            hookLine: sp.hookLine,
            tierLabel: sp.tierLabel,
            status: "pending",
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error("Failed to generate social posts:", e);
    }

    res.status(201).json(storage.getBuild(build.id));
  });

  app.delete("/api/builds/:id", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteBuild(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Admin Social Queue endpoints ──
  // IMPORTANT: static routes must come before parameterized (:id) routes

  app.get("/api/admin/social-queue", (req, res) => {
    const { adminUserId, platform, status, gameId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });

    const filters: { platform?: string; status?: string; gameId?: number } = {};
    if (platform && platform !== "all") filters.platform = platform as string;
    if (status && status !== "all") filters.status = status as string;
    if (gameId) filters.gameId = parseInt(gameId as string);

    const posts = storage.getSocialPosts(filters);

    // Enrich with build info
    const enriched = posts.map(post => {
      const build = storage.getBuild(post.buildId);
      return {
        ...post,
        buildName: build?.name ?? "Unknown Build",
        gameName: build?.gameName ?? "Unknown Game",
        className: build?.className ?? "",
        mastery: build?.mastery ?? "",
        upvotes: build?.upvotes ?? 0,
        downvotes: build?.downvotes ?? 0,
      };
    });

    res.json(enriched);
  });

  // Static sub-routes BEFORE parameterized routes
  app.post("/api/admin/social-queue/generate-all", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });

    const allBuilds = storage.getBuilds();
    let generated = 0;

    for (const build of allBuilds) {
      if (!storage.hasSocialPostsForBuild(build.id)) {
        const tier = getTierFromScore(build.upvotes, build.downvotes);
        const socialPostsData = generateSocialPosts(build, build.gameName, tier);
        for (const sp of socialPostsData) {
          storage.createSocialPost({
            buildId: build.id,
            gameId: build.gameId,
            platform: sp.platform,
            content: sp.content,
            hashtags: sp.hashtags,
            hookLine: sp.hookLine,
            tierLabel: sp.tierLabel,
            status: "pending",
            createdAt: new Date().toISOString(),
          });
        }
        generated += 4;
      }
    }

    res.json({ generated, message: `Generated ${generated} social posts` });
  });

  app.post("/api/admin/social-queue/regenerate/:buildId", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });

    const buildId = parseInt(req.params.buildId);
    const build = storage.getBuild(buildId);
    if (!build) return res.status(404).json({ error: "Build not found" });

    // Delete existing posts for this build
    storage.deleteSocialPostsForBuild(buildId);

    // Regenerate
    const tier = getTierFromScore(build.upvotes, build.downvotes);
    const socialPostsData = generateSocialPosts(build, build.gameName, tier);
    const created = [];
    for (const sp of socialPostsData) {
      const post = storage.createSocialPost({
        buildId: build.id,
        gameId: build.gameId,
        platform: sp.platform,
        content: sp.content,
        hashtags: sp.hashtags,
        hookLine: sp.hookLine,
        tierLabel: sp.tierLabel,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      created.push(post);
    }
    res.json(created);
  });

  // Parameterized routes after static routes
  app.post("/api/admin/social-queue/:id/approve", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateSocialPostStatus(parseInt(req.params.id), "approved");
    if (!updated) return res.status(404).json({ error: "Post not found" });
    res.json(updated);
  });

  app.post("/api/admin/social-queue/:id/posted", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateSocialPostStatus(parseInt(req.params.id), "posted");
    if (!updated) return res.status(404).json({ error: "Post not found" });
    res.json(updated);
  });

  app.delete("/api/admin/social-queue/:id", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteSocialPost(parseInt(req.params.id));
    res.json({ ok: true });
  });

  app.get("/api/admin/social-stats", (req, res) => {
    const { adminUserId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    res.json(storage.getSocialStats());
  });

  // ── Admin endpoints ──

  app.get("/api/admin/builds", (req, res) => {
    const { adminUserId, gameId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    res.json(storage.getBuilds(gameId ? { gameId: parseInt(gameId as string) } : undefined));
  });

  app.get("/api/admin/users", (req, res) => {
    const { adminUserId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const allUsers = storage.getAllUsers();
    res.json(allUsers.map(({ passwordHash, ...u }) => u));
  });

  // ── Votes ──

  app.post("/api/builds/:id/vote", (req, res) => {
    const buildId = parseInt(req.params.id);
    const { userId, voteType } = req.body;

    if (!userId || !["up", "down"].includes(voteType)) {
      return res.status(400).json({ error: "Invalid vote" });
    }

    const build = storage.getBuild(buildId);
    if (!build) return res.status(404).json({ error: "Build not found" });

    const existing = storage.getVote(buildId, userId);
    if (existing && existing.voteType === voteType) {
      storage.removeVote(buildId, userId);
      return res.json({ build: storage.getBuild(buildId), action: "removed" });
    }

    storage.castVote(buildId, userId, voteType);
    res.json({ build: storage.getBuild(buildId), action: "voted" });
  });

  app.post("/api/builds/:id/anon-vote", (req, res) => {
    const buildId = parseInt(req.params.id);
    const { voteType } = req.body;

    if (!["up", "down"].includes(voteType)) {
      return res.status(400).json({ error: "Invalid vote type" });
    }

    const build = storage.getBuild(buildId);
    if (!build) return res.status(404).json({ error: "Build not found" });

    const voterHash = getVoterHash(req, res);
    const existing = db.all(sql`SELECT * FROM anon_votes WHERE build_id = ${buildId} AND voter_hash = ${voterHash}`);
    const existingVote = existing[0] as any;

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Toggle off
        db.run(sql`DELETE FROM anon_votes WHERE id = ${existingVote.id}`);
        if (voteType === "up") {
          db.run(sql`UPDATE builds SET upvotes = upvotes - 1 WHERE id = ${buildId}`);
          if (build.submitterId) storage.updateKarma(build.submitterId, -1);
        } else {
          db.run(sql`UPDATE builds SET downvotes = downvotes - 1 WHERE id = ${buildId}`);
          if (build.submitterId) storage.updateKarma(build.submitterId, 1);
        }
        return res.json({ build: storage.getBuild(buildId), action: "removed", voterHash });
      } else {
        // Switch vote
        if (existingVote.vote_type === "up") {
          db.run(sql`UPDATE builds SET upvotes = upvotes - 1 WHERE id = ${buildId}`);
          if (build.submitterId) storage.updateKarma(build.submitterId, -1);
        } else {
          db.run(sql`UPDATE builds SET downvotes = downvotes - 1 WHERE id = ${buildId}`);
          if (build.submitterId) storage.updateKarma(build.submitterId, 1);
        }
        db.run(sql`UPDATE anon_votes SET vote_type = ${voteType}, created_at = ${new Date().toISOString()} WHERE id = ${existingVote.id}`);
      }
    } else {
      db.run(sql`INSERT INTO anon_votes (build_id, voter_hash, vote_type, created_at) VALUES (${buildId}, ${voterHash}, ${voteType}, ${new Date().toISOString()})`);
    }

    if (voteType === "up") {
      db.run(sql`UPDATE builds SET upvotes = upvotes + 1 WHERE id = ${buildId}`);
      if (build.submitterId) storage.updateKarma(build.submitterId, 1);
    } else {
      db.run(sql`UPDATE builds SET downvotes = downvotes + 1 WHERE id = ${buildId}`);
      if (build.submitterId) storage.updateKarma(build.submitterId, -1);
    }

    res.json({ build: storage.getBuild(buildId), action: "voted", voterHash });
  });

  app.get("/api/votes/user/:userId", (req, res) => {
    res.json(storage.getUserVotes(parseInt(req.params.userId)));
  });

  app.get("/api/anon-votes/:voterHash", (req, res) => {
    const rows = db.all(sql`SELECT build_id, vote_type FROM anon_votes WHERE voter_hash = ${req.params.voterHash}`);
    res.json(rows);
  });

  app.get("/api/voter-hash", (req, res) => {
    res.json({ voterHash: getVoterHash(req, res) });
  });

  // ── Auth ──

  app.post("/api/auth/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3 || password.length < 4) {
      return res.status(400).json({ error: "Username must be 3+ chars, password 4+ chars" });
    }
    if (storage.getUserByUsername(username)) {
      return res.status(409).json({ error: "Username already taken" });
    }
    const user = storage.createUser({ username, passwordHash: password });

    const voterHash = getVoterHash(req, res);
    const anonBuilds = db.all(sql`SELECT id FROM builds WHERE anon_hash = ${voterHash}`);
    if (anonBuilds.length > 0) {
      db.run(sql`UPDATE builds SET submitter_id = ${user.id}, anon_hash = NULL WHERE anon_hash = ${voterHash}`);
      db.run(sql`UPDATE users SET build_submissions = build_submissions + ${anonBuilds.length} WHERE id = ${user.id}`);
    }
    const anonVoteRows = db.all(sql`SELECT build_id, vote_type FROM anon_votes WHERE voter_hash = ${voterHash}`) as any[];
    for (const av of anonVoteRows) {
      const existing = storage.getVote(av.build_id, user.id);
      if (!existing) {
        db.run(sql`INSERT INTO votes (build_id, user_id, vote_type, created_at) VALUES (${av.build_id}, ${user.id}, ${av.vote_type}, ${new Date().toISOString()})`);
      }
    }
    db.run(sql`DELETE FROM anon_votes WHERE voter_hash = ${voterHash}`);

    const refreshed = storage.getUserById(user.id);
    const { passwordHash, ...safe } = refreshed || user;
    res.status(201).json(safe);
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = storage.getUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const voterHash = getVoterHash(req, res);
    const anonBuilds = db.all(sql`SELECT id FROM builds WHERE anon_hash = ${voterHash}`);
    if (anonBuilds.length > 0) {
      db.run(sql`UPDATE builds SET submitter_id = ${user.id}, anon_hash = NULL WHERE anon_hash = ${voterHash}`);
      db.run(sql`UPDATE users SET build_submissions = build_submissions + ${anonBuilds.length} WHERE id = ${user.id}`);
    }
    const anonVoteRows = db.all(sql`SELECT build_id, vote_type FROM anon_votes WHERE voter_hash = ${voterHash}`) as any[];
    for (const av of anonVoteRows) {
      const existing = storage.getVote(av.build_id, user.id);
      if (!existing) {
        db.run(sql`INSERT INTO votes (build_id, user_id, vote_type, created_at) VALUES (${av.build_id}, ${user.id}, ${av.vote_type}, ${new Date().toISOString()})`);
      }
    }
    db.run(sql`DELETE FROM anon_votes WHERE voter_hash = ${voterHash}`);

    const refreshed = storage.getUserById(user.id);
    const { passwordHash, ...safe } = refreshed || user;
    res.json(safe);
  });

  app.get("/api/users/:id", (req, res) => {
    const user = storage.getUserById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safe } = user;
    const userBuilds = storage.getUserBuilds(user.id);
    res.json({ ...safe, builds: userBuilds });
  });

  app.get("/api/users/top/leaderboard", (req, res) => {
    const topUsers = storage.getTopUsers(20);
    res.json(topUsers.map(({ passwordHash, ...u }) => u));
  });

  // ── Source detection & extraction ──

  app.post("/api/detect-source", (req, res) => {
    const { url } = req.body;
    res.json({ source: detectSource(url || "") });
  });

  app.post("/api/extract-build", async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== "string") return res.status(400).json({ error: "URL is required" });
    try { new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }
    try {
      const extracted = await extractBuildFromUrl(url);
      res.json(extracted);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to extract build info", details: e.message });
    }
  });
}

// ─── Tier list helper ──────────────────────────────────────────

function buildTierList(allBuilds: any[]) {
  const scored = allBuilds.map(b => ({
    ...b,
    score: b.upvotes - b.downvotes,
    ratio: b.upvotes + b.downvotes > 0 ? b.upvotes / (b.upvotes + b.downvotes) : 0.5,
  }));
  scored.sort((a, b) => b.score - a.score);

  const total = scored.length;
  const tiered = scored.map((build, i) => {
    const pct = total > 0 ? i / total : 1;
    let tier: string;
    if (pct < 0.1) tier = "S";
    else if (pct < 0.25) tier = "A";
    else if (pct < 0.50) tier = "B";
    else if (pct < 0.75) tier = "C";
    else tier = "D";
    return { ...build, tier };
  });

  const tierList: Record<string, typeof tiered> = { S: [], A: [], B: [], C: [], D: [] };
  for (const build of tiered) tierList[build.tier].push(build);
  return tierList;
}
