import type { Express } from "express";
import type { Server } from "http";
import { storage, verifyPassword, detectSource } from "./storage";
import { insertBuildSchema, insertSeasonSchema, insertGameSchema, insertGameClassSchema, insertGameModeSchema, insertCategorySchema } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { extractBuildFromUrl } from "./extract";
import { generateSocialPosts, getTierFromScore } from "./social";
import crypto from "crypto";
import { hashPassword as hashPwd } from "./hashutil";

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
    logo_url TEXT,
    category TEXT NOT NULL DEFAULT 'arpg',
    is_active INTEGER NOT NULL DEFAULT 1,
    has_seasons INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    last_featured_at TEXT,
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

  // Categories
  db.run(sql`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL DEFAULT '🎮',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  // Bookmarks
  db.run(sql`CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    build_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_unique ON bookmarks(build_id, user_id)`);

  // Anonymous bookmarks
  db.run(sql`CREATE TABLE IF NOT EXISTS anon_bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    voter_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_anon_bookmarks_unique ON anon_bookmarks(build_id, voter_hash)`);

  // Reports
  db.run(sql`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    voter_hash TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'inappropriate',
    created_at TEXT NOT NULL
  )`);

  // Build sources (reference directory)
  db.run(sql`CREATE TABLE IF NOT EXISTS build_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    game_id INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_checked_at TEXT,
    created_at TEXT NOT NULL
  )`);

  // Social accounts
  db.run(sql`CREATE TABLE IF NOT EXISTS social_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`);

  // Add new columns to existing tables if not exists
  try { db.run(sql`ALTER TABLE users ADD COLUMN bio TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE users ADD COLUMN avatar_emoji TEXT DEFAULT '🎮'`); } catch {}
  try { db.run(sql`ALTER TABLE games ADD COLUMN last_featured_at TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE games ADD COLUMN logo_url TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN views INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN social_score INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN social_views INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN social_shares INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN is_trending INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN is_viral INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN trending_reason TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN pros TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN cons TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN engagement_text TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN difficulty TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN budget_level TEXT`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN thumbnail_url TEXT`); } catch {}
  // New tier voting columns
  try { db.run(sql`ALTER TABLE builds ADD COLUMN calculated_tier TEXT NOT NULL DEFAULT 'N'`); } catch {}
  try { db.run(sql`ALTER TABLE builds ADD COLUMN tier_vote_count INTEGER NOT NULL DEFAULT 0`); } catch {}

  // Tier votes table (registered users)
  db.run(sql`CREATE TABLE IF NOT EXISTS tier_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    tier_vote TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_tier_votes_unique ON tier_votes(build_id, user_id)`);

  // Anon tier votes
  db.run(sql`CREATE TABLE IF NOT EXISTS anon_tier_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    voter_hash TEXT NOT NULL,
    tier_vote TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_anon_tier_votes_unique ON anon_tier_votes(build_id, voter_hash)`);

  // Seed categories if empty
  const catCount = db.all(sql`SELECT count(*) as c FROM categories`);
  // @ts-ignore
  if (catCount[0]?.c === 0) {
    const catData = [
      { name: "ARPG", slug: "arpg", icon: "⚔️", sortOrder: 100 },
      { name: "Looter-Shooter", slug: "looter-shooter", icon: "🔫", sortOrder: 80 },
      { name: "MMORPG", slug: "mmo", icon: "🌍", sortOrder: 60 },
      { name: "Survival", slug: "survival", icon: "🏕️", sortOrder: 40 },
      { name: "Other", slug: "other", icon: "🎮", sortOrder: 0 },
    ];
    for (const c of catData) {
      storage.createCategory({ name: c.name, slug: c.slug, icon: c.icon, sortOrder: c.sortOrder });
    }
  }

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
  // ── Single admin user: haripako ──
  const haripako = storage.createUser({ username: "haripako", passwordHash: "admin123" });
  db.run(sql`UPDATE users SET is_admin = 1, karma = 0 WHERE id = ${haripako.id}`);


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
      slug: g.slug, name: g.name, color: g.color, icon: g.icon, logoUrl: `/game-logos/${g.slug}.png`,
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
  // All builds submitted by haripako with 0 votes (N-tier until community votes)

  type RichBuild = {
    name: string; className: string; mastery?: string; playstyle: string;
    description: string; guideUrl: string;
    pros: string[]; cons: string[]; engagementText: string;
    difficulty: "beginner" | "intermediate" | "advanced" | "expert";
    budgetLevel: "budget" | "mid-range" | "expensive" | "endgame";
  };

  function insertBuild(gameId: number, gameModeId: number, seasonId: number | null, b: RichBuild) {
    const created = storage.createBuild({
      gameId, gameModeId, seasonId,
      name: b.name, className: b.className, mastery: b.mastery ?? "",
      playstyle: b.playstyle, description: b.description,
      guideUrl: b.guideUrl, mainSkills: "[]",
      submitterId: haripako.id, gameClassId: null, anonHash: null,
      pros: JSON.stringify(b.pros),
      cons: JSON.stringify(b.cons),
      engagementText: b.engagementText,
      difficulty: b.difficulty,
      budgetLevel: b.budgetLevel,
    });
    // Zero votes — community hasn't rated yet
    return created;
  }

  // ─ Last Epoch (15 builds) ─
  const leDefaultMode = createdModes["last-epoch"]["softcore"];
  const leBuilds: RichBuild[] = [
    {
      name: "Warpath Void Knight", className: "Sentinel", mastery: "Void Knight",
      guideUrl: "https://maxroll.gg/last-epoch/build-guides/warpath-void-knight",
      description: "Spinning to win with Void damage echoes. High mobility and damage output.",
      playstyle: "melee",
      pros: ["Excellent mobility while spinning", "Strong AoE clear with Void echoes", "Very satisfying playstyle", "Great at all content stages"],
      cons: ["Squishy until defensive gear acquired", "Requires Void Knight mastery investment", "Can be expensive to min-max"],
      engagementText: "Spin through enemies leaving trails of void destruction. This S-tier pick destroys everything while making you feel invincible.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Ballista Falconer", className: "Rogue", mastery: "Falconer",
      guideUrl: "https://maxroll.gg/last-epoch/build-guides/ballista-falconer",
      description: "Turret-based ranged build with massive DPS potential from multiple ballistae.",
      playstyle: "ranged",
      pros: ["Massive single-target DPS", "Great for bossing", "Relatively safe ranged playstyle", "Falcon pet adds extra damage"],
      cons: ["Setup time placing ballistae", "Less mobile than other rogues", "Falcon can die in dangerous content"],
      engagementText: "Deploy a field of deadly turrets and watch enemies melt. Falconer Ballista is THE bossing powerhouse of Season 4.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Erasing Strike Void Knight", className: "Sentinel", mastery: "Void Knight",
      guideUrl: "https://www.lastepochtools.com/builds/erasing-strike-void-knight",
      description: "One of the highest single-target DPS builds in the game using Void echoes.",
      playstyle: "melee",
      pros: ["Top-tier single-target damage", "Void echoes amplify every hit", "Tanky playstyle", "Excellent boss killer"],
      cons: ["Slow mapping compared to AoE builds", "Requires specific uniques to shine", "Complex echo management"],
      engagementText: "Literally erase bosses from existence. Erasing Strike Void Knight hits so hard it leaves afterimages of destruction.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Judgement Aura Paladin", className: "Sentinel", mastery: "Paladin",
      guideUrl: "https://maxroll.gg/last-epoch/build-guides/judgement-paladin",
      description: "Holy damage AoE build that clears maps incredibly fast with Judgement and Aura.",
      playstyle: "melee",
      pros: ["Insane AoE clear speed", "Holy damage ignores many resistances", "Strong defensive auras", "Fun to play"],
      cons: ["Vulnerable to chaos damage", "Requires high mana sustain", "Aura management complex"],
      engagementText: "Rain holy judgment on your enemies. This Paladin build turns you into a one-man apocalypse across every map.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Anurok Frogs Beastmaster", className: "Primalist", mastery: "Beastmaster",
      guideUrl: "https://maxroll.gg/last-epoch/build-guides/beastmaster-frogs",
      description: "Unique frog minion build with high chaos clear speed in S4.",
      playstyle: "summoner",
      pros: ["Unique and fun playstyle", "Strong chaos clear", "Frogs provide excellent coverage", "Budget-friendly starter"],
      cons: ["Frogs are fragile", "Limited bossing capability", "Requires Season 4 specific gear"],
      engagementText: "Unleash an army of chaos frogs and watch the screen explode. This meme build is secretly one of S4's best farmers.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Lightning Blast Runemaster", className: "Mage", mastery: "Runemaster",
      guideUrl: "https://www.lastepochtools.com/builds/runemaster-lightning",
      description: "Chain lightning Runemaster with insane pack clear using Runic Invocation combos.",
      playstyle: "caster",
      pros: ["Insane pack clear speed", "Chain lightning covers the entire screen", "Very satisfying visual feedback", "Strong in all content"],
      cons: ["Squishy playstyle", "Mana management required", "Complex Runic Invocation combos"],
      engagementText: "Call down the storm and chain lightning through entire rooms. Runemaster has never felt this powerful — S4 is its season.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Abomination Necromancer", className: "Acolyte", mastery: "Necromancer",
      guideUrl: "https://maxroll.gg/last-epoch/build-guides/abomination-necromancer",
      description: "Melee minion juggernaut — your Abomination grows stronger with each kill.",
      playstyle: "summoner",
      pros: ["Abomination scales infinitely with kills", "Very tanky melee presence", "Fun growth mechanic", "Strong endgame"],
      cons: ["Slow early game", "Abomination can die", "Limited AoE compared to other summoners"],
      engagementText: "Build a monster that gets stronger with every kill. Your Abomination eventually becomes unstoppable — the ultimate power fantasy.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Rip Blood Warlock", className: "Acolyte", mastery: "Warlock",
      guideUrl: "https://www.lastepochtools.com/builds/rip-blood-warlock",
      description: "Blood magic build that sacrifices health for incredible damage output.",
      playstyle: "caster",
      pros: ["Massive damage potential", "Unique blood magic theme", "Great burst damage", "Strong scaling"],
      cons: ["Constantly at low health", "Requires careful defensive layering", "Steep learning curve"],
      engagementText: "Sacrifice your own blood to deal ungodly damage. Rip Blood Warlock lives on the edge — and it absolutely slaps.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Storm Crows Beastmaster", className: "Primalist", mastery: "Beastmaster",
      guideUrl: "https://www.lastepochtools.com/builds/beastmaster-storm-crows",
      description: "Crow minion build with storm synergies for large AoE clear.",
      playstyle: "summoner",
      pros: ["Large AoE from crow storm synergies", "Multiple crows provide map coverage", "Relaxed playstyle", "Good clear speed"],
      cons: ["Crows can scatter unpredictably", "Less effective in narrow corridors", "Requires Storm Amulet for best performance"],
      engagementText: "Summon a murder of crows and call down lightning through them. It's as badass as it sounds and clears maps like a storm.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Profane Veil Warlock", className: "Acolyte", mastery: "Warlock",
      guideUrl: "https://www.lastepochtools.com/builds/profane-veil-warlock",
      description: "Near-unkillable Warlock using Profane Veil for constant damage mitigation.",
      playstyle: "caster",
      pros: ["Exceptional survivability", "Profane Veil provides permanent mitigation", "Strong damage output", "Great for hardcore"],
      cons: ["Lower damage than offensive builds", "Requires specific gear for Veil uptime", "Limited mobility"],
      engagementText: "Become nearly unkillable while dealing huge damage. Profane Veil Warlock laughs at the content that kills other builds.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Zombie Warlock", className: "Acolyte", mastery: "Warlock",
      guideUrl: "https://maxroll.gg/last-epoch/build-guides/zombie-warlock",
      description: "Endless zombie army with exceptional clear speed. Very relaxed playstyle.",
      playstyle: "summoner",
      pros: ["Zombie horde overwhelms everything", "Very relaxed gameplay", "Fast map clear", "Budget-friendly"],
      cons: ["Zombies have limited intelligence", "Requires positioning awareness", "Slow single-target"],
      engagementText: "Summon a literal zombie apocalypse. Just walk around while hundreds of undead clear the entire screen for you.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Flay Mana Lich", className: "Acolyte", mastery: "Lich",
      guideUrl: "https://www.lastepochtools.com/builds/lich-flay",
      description: "Mana-fed Lich that unleashes devastating Flay and Reaper Form.",
      playstyle: "caster",
      pros: ["Reaper Form is incredibly powerful", "Flay deals huge damage", "Unique mana-as-fuel mechanic", "Strong boss damage"],
      cons: ["Complex resource management", "Reaper Form has cooldown", "Squishy outside of Reaper Form"],
      engagementText: "Transform into a death god and shred everything with ethereal claws. Flay Lich in Reaper Form is the most terrifying thing in Last Epoch.",
      difficulty: "advanced", budgetLevel: "mid-range",
    },
    {
      name: "Bladestorm Bladedancer", className: "Rogue", mastery: "Bladedancer",
      guideUrl: "https://maxroll.gg/last-epoch/build-guides/bladedancer-bladestorm",
      description: "Whirlwind blade melee with incredible movement speed and proc generation.",
      playstyle: "melee",
      pros: ["Incredible movement speed", "High proc generation", "Fluid, fun playstyle", "Good AoE"],
      cons: ["Less tanky than Sentinel builds", "Requires high dodge investment", "Can struggle with stationary bosses"],
      engagementText: "Become a living tornado of blades. Bladestorm Bladedancer is the fastest, most fluid melee experience in Last Epoch.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Judgement Paladin HC", className: "Sentinel", mastery: "Paladin",
      guideUrl: "https://www.lastepochtools.com/builds/paladin-judgement-hc",
      description: "Safe HC Paladin with maximum block, Sigils stacks, and Holy damage.",
      playstyle: "melee",
      pros: ["Extremely safe for Hardcore", "Maximum block chance", "Strong Holy damage", "Self-sufficient sustain"],
      cons: ["Slower kill speed than offensive builds", "Requires high block gear", "Less exciting than other builds"],
      engagementText: "The only Paladin build trusted by Hardcore players. Maximum block, maximum sustain — death simply doesn't apply here.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Fire Aura Spellblade", className: "Mage", mastery: "Spellblade",
      guideUrl: "https://maxroll.gg/last-epoch/build-guides/spellblade-fire-aura",
      description: "Melee fire caster with Enchant Weapon and Surge for blazing DPS.",
      playstyle: "hybrid",
      pros: ["Unique melee + caster hybrid", "High sustained DPS", "Enchant Weapon provides huge boost", "Fun playstyle"],
      cons: ["Requires both melee and caster gear", "Complex to optimize", "Squishy without defensive investment"],
      engagementText: "Melee + magic in perfect harmony. Fire Aura Spellblade hits like a truck on fire and it never gets old.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
  ];
  for (const b of leBuilds) insertBuild(leId, leDefaultMode.id, leS4.id, b);

  // ─ Diablo IV (15 builds) ─
  const d4DefaultMode = createdModes["diablo-4"]["softcore"];
  const d4Builds: RichBuild[] = [
    {
      name: "Thorns Blessed Shield Paladin", className: "Paladin",
      guideUrl: "https://maxroll.gg/d4/build-guides/thorns-blessed-shield-paladin",
      description: "Thorns-scaling Paladin that reflects massive damage back to enemies.",
      playstyle: "melee",
      pros: ["Enemies hurt themselves attacking you", "Very tanky playstyle", "Strong Pit pushing", "Satisfying retaliation fantasy"],
      cons: ["Requires specific Thorns gear", "Limited to melee range", "Can be slow vs ranged enemies"],
      engagementText: "Let enemies kill themselves on your divine thorns. This Paladin build makes you an impenetrable fortress of holy pain.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Blessed Hammer Paladin", className: "Paladin",
      guideUrl: "https://maxroll.gg/d4/build-guides/blessed-hammer-paladin",
      description: "Classic Hammerdin revived for D4 with Blessed Hammer creating spinning projectiles.",
      playstyle: "melee",
      pros: ["Classic iconic build", "Excellent AoE coverage", "Magic damage bypasses many immunities", "Strong throughout progression"],
      cons: ["Hammers spiral unpredictably", "Requires positioning skill", "Gear-dependent for high Pit"],
      engagementText: "The legendary Hammerdin is back and better than ever. Blessed Hammer spirals of holy destruction — a D2 classic reborn.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "Aura Paladin (Auradin)", className: "Paladin",
      guideUrl: "https://maxroll.gg/d4/build-guides/aura-paladin",
      description: "Passive aura-driven build that damages everything on screen permanently.",
      playstyle: "melee",
      pros: ["Passive damage requires minimal input", "AoE covers entire screen", "Excellent for lazy farming", "Strong defenses"],
      cons: ["Lower burst than active builds", "Requires multiple aura items", "Less effective in single-target"],
      engagementText: "Walk into a room and everything starts dying. Auradin is the ultimate AFK farming build — your auras do all the work.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "Wing Strikes Paladin", className: "Paladin",
      guideUrl: "https://maxroll.gg/d4/build-guides/wing-strikes-paladin",
      description: "Aerial attack Paladin with massive burst damage on demand.",
      playstyle: "melee",
      pros: ["Massive burst damage windows", "High mobility", "Looks spectacular", "Strong boss damage"],
      cons: ["Cooldown-dependent", "Complex timing required", "Requires Wings unique"],
      engagementText: "Descend from the heavens and obliterate everything in a single divine strike. Wing Strikes Paladin is S12's most satisfying execution.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Pulverize Druid", className: "Druid",
      guideUrl: "https://maxroll.gg/d4/build-guides/pulverize-druid",
      description: "Werebear form slamming everything with Pulverize — huge AoE and great sustain.",
      playstyle: "melee",
      pros: ["Massive AoE slam coverage", "Werebear form provides tankiness", "High movement speed", "Fun transformation playstyle"],
      cons: ["Requires Pulverize-specific gear", "Less effective in narrow corridors", "Complex Werebear uptime management"],
      engagementText: "Transform into a raging werebear and slam the earth hard enough to shake the heavens. Pulverize Druid makes you the biggest thing in the dungeon.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Hammer of the Ancients Barbarian", className: "Barbarian",
      guideUrl: "https://maxroll.gg/d4/build-guides/hota-barbarian",
      description: "Single massive hammer blow that obliterates all enemies in one hit.",
      playstyle: "melee",
      pros: ["One-shot potential on bosses", "Extremely satisfying impact", "High burst damage", "Strong Fury generation"],
      cons: ["Limited AoE coverage", "Requires Berserking uptime", "Fury management complex"],
      engagementText: "One swing. One kill. HotA Barbarian drops a hammer that echoes through Sanctuary. The most satisfying hit in all of D4.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Lunging Strike Barbarian", className: "Barbarian",
      guideUrl: "https://maxroll.gg/d4/build-guides/lunging-strike-barbarian",
      description: "Frenzy-stacking brawler with high uptime damage and great mobility.",
      playstyle: "melee",
      pros: ["Excellent mobility with Lunge", "High sustained DPS", "Good at chasing enemies", "Budget starter option"],
      cons: ["Less bursty than HotA", "Requires Frenzy stacks", "Vulnerable during leap animation"],
      engagementText: "Chase down every enemy across the dungeon and beat them to death. Lunging Strike Barb never stops moving — perfect for speed farming.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Crackling Energy Sorcerer", className: "Sorcerer",
      guideUrl: "https://maxroll.gg/d4/build-guides/crackling-energy-sorcerer",
      description: "Lightning Sorcerer that passively spawns Crackling Energy orbs for massive damage.",
      playstyle: "caster",
      pros: ["Passive orbs deal huge damage", "Excellent AoE coverage", "Very satisfying visual effect", "Strong Season 12 meta pick"],
      cons: ["Fragile against one-shots", "Crackling Energy placement dependent", "Requires specific aspects"],
      engagementText: "Become a walking lightning storm that automatically destroys everything nearby. Crackling Energy Sorc is the most electric build in S12.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Payback Spiritborn", className: "Spiritborn",
      guideUrl: "https://maxroll.gg/d4/build-guides/payback-spiritborn",
      description: "Spirit-powered retaliation build with insane damage scaling on tanky characters.",
      playstyle: "hybrid",
      pros: ["Top-tier Pit pushing", "Insane Thorns scaling", "Tanky playstyle", "S-tier in current meta"],
      cons: ["Requires specific uniques", "Slow clear speed vs mobs", "Complex gear optimization"],
      engagementText: "Turn enemy damage against them. Payback Spiritborn is crushing Pit 120+ and the community can't stop talking about it.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Infinite Evade Eagle Spiritborn", className: "Spiritborn",
      guideUrl: "https://maxroll.gg/d4/build-guides/eagle-spiritborn-evade",
      description: "Eagle aspect Spiritborn with infinite Evade charges for constant repositioning.",
      playstyle: "ranged",
      pros: ["Infinite repositioning", "Never stops moving", "Excellent Evade synergies", "Hard to hit by enemies"],
      cons: ["Complex rotation management", "Requires Eagle-specific gear", "Less tanky than other Spiritborn"],
      engagementText: "Evade infinitely through enemies leaving destruction in your wake. Eagle Spiritborn makes you the most agile force in all of S12.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Golem Necromancer", className: "Necromancer",
      guideUrl: "https://maxroll.gg/d4/build-guides/golem-necromancer",
      description: "Iron Golem as the primary damage dealer with Necromancer buffs and minions.",
      playstyle: "summoner",
      pros: ["Iron Golem deals massive damage", "Very tanky frontline minion", "Relaxed playstyle", "Great for new players"],
      cons: ["Single primary minion means it can die", "Slow compared to fast clears", "Requires Golem gear"],
      engagementText: "Unleash an unstoppable iron giant and command it to destroy everything. Golem Necro is the ultimate power-through-brute-force fantasy.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "Shadow Blight Necromancer", className: "Necromancer",
      guideUrl: "https://maxroll.gg/d4/build-guides/shadow-blight-necromancer",
      description: "Shadow realm DoT build with excellent wave clear through Blight explosions.",
      playstyle: "caster",
      pros: ["Excellent wave clear", "Blight explosions chain beautifully", "Strong DoT damage", "Good for speed farming"],
      cons: ["Requires DoT stacking knowledge", "Shadow damage less effective vs. non-demons", "Squishy"],
      engagementText: "Corrupt the very shadow beneath enemies' feet. Shadow Blight Necro makes every room a death trap of spreading darkness.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Heartseeker Rogue", className: "Rogue",
      guideUrl: "https://maxroll.gg/d4/build-guides/heartseeker-rogue",
      description: "Bow Rogue using Heartseeker to rapidly stack critical hit multipliers.",
      playstyle: "ranged",
      pros: ["Rapidly stacks critical multipliers", "Excellent from safe range", "High sustained damage", "Mobile playstyle"],
      cons: ["Energy management challenging", "Requires critical hit investment", "Less effective in close quarters"],
      engagementText: "Rain arrows that never miss the heart. Heartseeker Rogue stacks crits so fast enemies don't know what hit them.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Death Trap Rogue", className: "Rogue",
      guideUrl: "https://maxroll.gg/d4/build-guides/death-trap-rogue",
      description: "Trap placement build with massive burst on boss encounters using Death Trap.",
      playstyle: "ranged",
      pros: ["Massive boss burst damage", "Safe playstyle placing traps", "Death Trap deals incredible damage", "Strong in endgame"],
      cons: ["Setup time placing traps", "Less effective in open areas", "Requires specific trap aspects"],
      engagementText: "Lay a perfect trap and watch bosses evaporate in seconds. Death Trap Rogue is the ultimate boss killer build in D4.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Earthquake Barbarian", className: "Barbarian",
      guideUrl: "https://maxroll.gg/d4/build-guides/earthquake-barbarian",
      description: "Ground-shaking melee Barbarian with stacking Earthquake damage on all enemies.",
      playstyle: "melee",
      pros: ["Stacking Earthquake DoT", "Excellent AoE ground coverage", "Very tanky", "Satisfying earth-shattering impacts"],
      cons: ["DoT build requires patience", "Less burst than HotA", "Ground effects complex to manage"],
      engagementText: "Shake the earth itself and bury everything under your fury. Earthquake Barb stacks more ground effects than any other build in the game.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
  ];
  for (const b of d4Builds) insertBuild(d4Id, d4DefaultMode.id, d4S12.id, b);

  // ─ Path of Exile 2 (15 builds) ─
  const poe2DefaultMode = createdModes["path-of-exile-2"]["trade-sc"];
  const poe2Builds: RichBuild[] = [
    {
      name: "Pathfinder Ladder Topper", className: "Ranger",
      guideUrl: "https://poe.ninja/builds/0.4?class=Ranger&corePassive=Pathfinder",
      description: "Top ladder Ranger using Pathfinder ascendancy for explosive flask scaling.",
      playstyle: "ranged",
      pros: ["Top ladder position", "Flask scaling is explosive", "Great map clear", "Strong in all content"],
      cons: ["Flask management intensive", "Expensive to fully gear", "Complex Pathfinder node interactions"],
      engagementText: "This is what the top 1% of PoE2 players are running. Pathfinder flask scaling reaches obscene damage levels — join the meta.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Titan Drubringer", className: "Warrior", mastery: "Titan",
      guideUrl: "https://maxroll.gg/poe2/build-guides/titan-warrior",
      description: "Massive ground slammer Titan that deals devastating blunt melee damage.",
      playstyle: "melee",
      pros: ["Enormous ground slam damage", "Very tanky Titan base", "Great at staggering enemies", "Strong throughout"],
      cons: ["Slow attack animations", "Limited mobility", "Requires heavy gear investment"],
      engagementText: "Hit the ground so hard the entire screen shakes. Titan Drubringer makes you the geological disaster enemies fear most.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Amazon Resurrect Ranger", className: "Ranger",
      guideUrl: "https://www.youtube.com/watch?v=poe2_ranger_s4",
      description: "Resurrection-stacking Amazon-spec Ranger with summon synergies.",
      playstyle: "summoner",
      pros: ["Unique summon synergies", "Resurrect mechanic is creative", "Strong at scale", "Interesting gameplay loop"],
      cons: ["Complex resurrection management", "Minions can be lost", "Requires understanding of summon mechanics"],
      engagementText: "Resurrect fallen enemies as your army while still destroying everything with your own arrows. Amazon Ranger is PoE2's most creative build.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Smith of Kitava Warrior", className: "Warrior", mastery: "Warbringer",
      guideUrl: "https://maxroll.gg/poe2/build-guides/smith-kitava-warrior",
      description: "Forge god Warrior that summons spectral weapons and overwhelms enemies.",
      playstyle: "melee",
      pros: ["Spectral weapons deal huge damage", "Kitava theme is incredibly cool", "Strong AoE", "Good survivability"],
      cons: ["Complex weapon summoning management", "Requires specific Warbringer nodes", "Expensive to gear"],
      engagementText: "Forge weapons from the essence of Kitava himself and hurl them at your enemies. This is the most metal Warrior build in PoE2.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Lich Malarz Witch", className: "Witch", mastery: "Blood Mage",
      guideUrl: "https://maxroll.gg/poe2/build-guides/witch-lich",
      description: "Death magic Witch with Lich spectres that reanimate slain enemies.",
      playstyle: "summoner",
      pros: ["Lich spectres are powerful", "Reanimate creates unlimited fodder", "Blood Mage damage scaling", "Strong AoE"],
      cons: ["Blood cost management", "Spectres need to be maintained", "Complex Blood Mage interactions"],
      engagementText: "Raise the dead from your own blood and command an ever-growing undead army. Lich Blood Mage is PoE2's darkest and most powerful summon build.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Oracle Druid", className: "Druid", mastery: "Warden",
      guideUrl: "https://maxroll.gg/poe2/build-guides/oracle-druid",
      description: "Prophetic oracle gameplay loop with high defensive layering.",
      playstyle: "caster",
      pros: ["Exceptional defensive layering", "Unique oracle mechanic", "Strong vs all content types", "High survivability"],
      cons: ["Moderate clear speed", "Complex defensive node pathing", "Requires Warden specific gear"],
      engagementText: "See the future and use it to survive every attack. Oracle Warden Druid tanks everything the endgame throws at it.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Titan Bear Wall", className: "Warrior", mastery: "Titan",
      guideUrl: "https://www.youtube.com/watch?v=poe2_titan_bear",
      description: "Nearly unkillable defensive Titan using totems and auras for permanent survival.",
      playstyle: "hybrid",
      pros: ["Nearly unkillable", "Excellent at tanking bosses", "Great for learning endgame", "Strong totem synergies"],
      cons: ["Very low mobility", "Slow clear speed", "Does not deal impressive damage"],
      engagementText: "Become the unmovable object. Titan Bear Wall has cleared Tier 15 maps while AFK and barely noticed.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Huntress Spear Dive", className: "Huntress", mastery: "Amazon",
      guideUrl: "https://maxroll.gg/poe2/build-guides/huntress-spear",
      description: "Flying spear Amazon with incredible single-target DPS and mobility.",
      playstyle: "ranged",
      pros: ["Incredible single-target DPS", "Flying mobility is exceptional", "Spear dive feels amazing", "Strong boss killer"],
      cons: ["Limited AoE without spear setup", "Requires Amazon ascendancy nodes", "Squishy during dive animation"],
      engagementText: "Leap through the air and spear bosses from above. Huntress Spear Dive is PoE2's most cinematic build and it absolutely destroys endgame.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Infernalist Fire Bomb", className: "Witch", mastery: "Infernalist",
      guideUrl: "https://maxroll.gg/poe2/build-guides/infernalist-witch",
      description: "Demonic fire-bomb playstyle with massive explosion radius and lingering flames.",
      playstyle: "caster",
      pros: ["Massive explosion radius", "Lingering flames prevent regrouping", "Demonic aesthetic is amazing", "Strong AoE"],
      cons: ["Fire resistance on bosses reduces damage", "Requires Infernalist-specific uniques", "Overheating mechanic to manage"],
      engagementText: "Set everything on fire and let it burn. Infernalist Fire Bomb makes the entire screen a hellscape — and you're the demon in charge.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Stormweaver Arc Sorceress", className: "Sorceress", mastery: "Stormweaver",
      guideUrl: "https://maxroll.gg/poe2/build-guides/stormweaver-arc",
      description: "Chain lightning Sorceress that bounces arc through entire screens of enemies.",
      playstyle: "caster",
      pros: ["Arc chains through entire screens", "Massive pack clear coverage", "Strong chain scaling", "Excellent mapping"],
      cons: ["Lightning resistance on bosses", "Chain behavior can be unpredictable", "Requires density for full effectiveness"],
      engagementText: "Send electricity bouncing through packs of enemies and watch the entire room light up. Arc Sorceress is the most satisfying clear build in PoE2.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Deadeye Tornado Shot", className: "Ranger", mastery: "Deadeye",
      guideUrl: "https://maxroll.gg/poe2/build-guides/deadeye-tornado-shot",
      description: "Bow-wielding Deadeye with tornado arrows piercing and bouncing through packs.",
      playstyle: "ranged",
      pros: ["Excellent pack clear with piercing", "Deadeye provides great utility", "Fast mapping", "Strong throughout progression"],
      cons: ["Requires good bow investment", "Tornado Shot projectiles complex", "Less effective single-target"],
      engagementText: "Fire tornados that pierce through entire packs and keep bouncing. Tornado Shot Deadeye is the definitive bow build of PoE2.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Invoker Monk Glacial", className: "Monk", mastery: "Invoker",
      guideUrl: "https://maxroll.gg/poe2/build-guides/invoker-monk-glacial",
      description: "Hand-to-hand ice monk freezing entire screens with glacial detonations.",
      playstyle: "melee",
      pros: ["Freeze provides enormous safety", "Glacial detonations deal huge damage", "Invoker buffs ice damage massively", "Excellent clear speed"],
      cons: ["Cold resistance on bosses", "Requires multiple freeze applications", "Expensive invoker gear"],
      engagementText: "Freeze entire rooms and shatter them like glass. Invoker Glacial Monk makes you feel like a one-person winter apocalypse.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Chronomancer Time Loop", className: "Sorceress", mastery: "Chronomancer",
      guideUrl: "https://www.youtube.com/watch?v=poe2_chrono",
      description: "Rewind time mechanics for maximum damage loops and defensive resets.",
      playstyle: "caster",
      pros: ["Time rewind is incredibly powerful", "Defensive resets prevent deaths", "Unique gameplay feel", "Strong damage loops"],
      cons: ["Complex time mechanic management", "Requires understanding Chronomancer", "High skill ceiling"],
      engagementText: "Rewind time to undo mistakes and repeat your best attacks forever. Chronomancer is PoE2's most mind-bending build — masters get infinite power.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "SSF Starter Mercenary", className: "Mercenary", mastery: "Witchhunter",
      guideUrl: "https://maxroll.gg/poe2/build-guides/mercenary-witchhunter-ssf",
      description: "Budget-friendly Witchhunter Mercenary that excels without expensive items.",
      playstyle: "ranged",
      pros: ["Excellent SSF starter", "Works without expensive items", "Witchhunter provides strong utility", "Safe ranged playstyle"],
      cons: ["Lower ceiling than trade builds", "Moderate single-target damage", "Limited by SSF gear availability"],
      engagementText: "Start your PoE2 season strong with zero currency investment. SSF Witchhunter proves you don't need top-tier gear to clear endgame.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Pathfinder Flask Ranger", className: "Ranger", mastery: "Pathfinder",
      guideUrl: "https://maxroll.gg/poe2/build-guides/pathfinder-flask-ranger",
      description: "Classic flask scaling build with permanent uptime on all flasks.",
      playstyle: "ranged",
      pros: ["Permanent flask uptime", "Classic and proven mechanics", "Strong throughout all content", "Highly satisfying to play"],
      cons: ["Flask management required", "Expensive to fully flask-gear", "Complex flask interaction chains"],
      engagementText: "Chain your flasks for infinite power scaling. Pathfinder Flask Ranger has been meta since PoE1 and it's absolutely dominant in PoE2.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
  ];
  for (const b of poe2Builds) insertBuild(poe2Id, poe2DefaultMode.id, poe2S4.id, b);

  // ─ Path of Exile (15 builds) ─
  const poeDefaultMode = createdModes["path-of-exile"]["trade-sc"];
  const poeBuilds: RichBuild[] = [
    {
      name: "Kinetic Fusillade Hierophant", className: "Templar",
      guideUrl: "https://poe.ninja/builds/3.28?class=Templar&corePassive=Hierophant",
      description: "Totem-buffed Kinetic Blast Hierophant with incredible pack-clearing speed.",
      playstyle: "ranged",
      pros: ["Incredible pack clearing speed", "Totem buffs amplify all damage", "Safe totem placement", "Strong in maps"],
      cons: ["Totems require placement setup", "Single target weaker vs packs", "Expensive min-maxing"],
      engagementText: "Set up your totems and watch kinetic explosions chain across the entire map. Hierophant Kinetic Fusillade is 3.28's fastest farmer.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Righteous Fire Chieftain", className: "Marauder",
      guideUrl: "https://poe.ninja/builds/3.28?class=Marauder&corePassive=Chieftain",
      description: "Classic RF build that burns everything including the character for damage scaling.",
      playstyle: "caster",
      pros: ["Burns everything in range continuously", "Very tanky Chieftain base", "Excellent flask sustain", "Budget-friendly entry"],
      cons: ["Slow movement if not invested", "Fire resistance stacking required", "Limited single target ceiling"],
      engagementText: "Set yourself on fire and walk through dungeons burning everything alive. RF Chieftain is the most iconic PoE build ever created — and it's still top tier.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Elemental Hit Slayer", className: "Duelist",
      guideUrl: "https://poe.ninja/builds/3.28?class=Duelist&corePassive=Slayer",
      description: "Elemental hit Slayer with one-shot potential on any random element.",
      playstyle: "ranged",
      pros: ["One-shot potential on any element", "Slayer provides life leech", "High burst damage", "Versatile element selection"],
      cons: ["Random element can be resisted", "Requires Elemental Hit skill gem", "Expensive to perfect"],
      engagementText: "One arrow, one element, one kill. Elemental Hit Slayer picks random destruction and rolls it into the most satisfying shots in PoE.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Lightning Arrow Deadeye", className: "Ranger",
      guideUrl: "https://poe.ninja/builds/3.28?class=Ranger&corePassive=Deadeye",
      description: "Top ladder bow build in 3.28 with chain lightning clearing entire maps.",
      playstyle: "ranged",
      pros: ["Top ladder-level power", "Chain lightning clears screen-wide", "Excellent mapping speed", "Strong at all endgame content"],
      cons: ["Expensive to reach ladder performance", "Lightning penetration required", "Complex bow modifiers needed"],
      engagementText: "The number one bow build in 3.28 ladder for a reason. LA Deadeye turns your arrows into chain lightning bolts that clear entire screens.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Kinetic Blast Necromancer", className: "Witch",
      guideUrl: "https://poe.ninja/builds/3.28?class=Witch&corePassive=Necromancer",
      description: "Wand-wielding Witch with explosions from Kinetic Blast chaining everywhere.",
      playstyle: "caster",
      pros: ["Explosions chain through packs beautifully", "Wand allows great projectile scaling", "Necromancer provides excellent auras", "Strong mapper"],
      cons: ["Requires good wand investment", "Explosion radius dependent", "Aura management overhead"],
      engagementText: "Point a wand and create chain explosions across every room. KB Necromancer is the most explosive non-explosion build in PoE.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Absolution Guardian", className: "Templar",
      guideUrl: "https://www.youtube.com/watch?v=poe_guardian_abs",
      description: "Minion summoner Guardian with Absolution spectres and massive aura stacking.",
      playstyle: "summoner",
      pros: ["Absolution spectres are powerful", "Massive aura stacking", "Guardian defensive benefits", "Strong group play synergy"],
      cons: ["Spectre acquisition required", "Complex aura stacking setup", "Dependent on spectre survival"],
      engagementText: "Build the ultimate support-summoner hybrid. Guardian Absolution commands an aura-buffed spectre army that melts everything it touches.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Flicker Strike Gladiator", className: "Duelist",
      guideUrl: "https://www.youtube.com/watch?v=poe_flicker_glad",
      description: "Teleporting melee madness with Flicker Strike at impossible speed.",
      playstyle: "melee",
      pros: ["Incomprehensible speed", "Never stops moving", "Frenzy charge management is exhilarating", "Incredibly fun"],
      cons: ["Epilepsy warning not a joke", "Very hard to control", "Dies if frenzy charges run out"],
      engagementText: "Move so fast you become a blur. Flicker Strike Gladiator is the most chaotic build in PoE and it clears maps before you even register being in them.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Holy Flame Totem Inquisitor", className: "Templar",
      guideUrl: "https://www.youtube.com/watch?v=poe_inquisitor_totem",
      description: "Budget-friendly Inquisitor placer with fire totems for excellent wave clear.",
      playstyle: "caster",
      pros: ["Excellent budget starter", "Fire totems clear packs safely", "Inquisitor penetration is powerful", "Safe playstyle"],
      cons: ["Totem placement required", "Slow compared to mobile builds", "Moderate single target"],
      engagementText: "The best budget starter in 3.28. HFT Inquisitor carries you from acts to red maps without spending a single Chaos orb.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Shock Nova Archmage Hierophant", className: "Templar",
      guideUrl: "https://www.youtube.com/watch?v=poe_shock_nova",
      description: "Massive mana-investment Archmage build with Shock Nova for insane damage.",
      playstyle: "caster",
      pros: ["Insane damage ceiling with mana", "Shock Nova covers huge AoE", "Unique mana-to-damage conversion", "Very high damage cap"],
      cons: ["Requires enormous mana investment", "Complex Archmage interactions", "Mirror-tier gear for max performance"],
      engagementText: "Convert thousands of mana into screen-deleting lightning rings. Archmage Shock Nova Hierophant is PoE's most expensive — and most devastating — build.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Exsanguinate Reap Miner Saboteur", className: "Shadow",
      guideUrl: "https://www.youtube.com/watch?v=poe_saboteur_mine",
      description: "Mine spammer Saboteur using blood spells for devastating detonation chains.",
      playstyle: "caster",
      pros: ["Detonation chains are incredibly satisfying", "Blood spells have unique flavor", "Strong damage per mine", "Saboteur bonuses are excellent"],
      cons: ["Mine placement takes micro management", "Long windup before detonation", "Requires mining investment"],
      engagementText: "Lay blood mines and detonate them in satisfying chain explosions. Exsanguinate Saboteur turns dark magic into one of the most fun mine builds ever.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Toxic Rain Pathfinder", className: "Ranger",
      guideUrl: "https://maxroll.gg/poe/build-guides/toxic-rain-pathfinder",
      description: "Bow DoT build that rains poison pods for relentless area denial.",
      playstyle: "ranged",
      pros: ["Excellent area denial with pods", "DoT scales extremely well", "Flask Pathfinder is very powerful", "Safe ranged playstyle"],
      cons: ["DoT requires target to stay in area", "Pod placement management", "Less effective vs fast-moving bosses"],
      engagementText: "Rain toxic pods and deny enemies any safe ground. Toxic Rain Pathfinder turns every map into a death zone of proliferating poison.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Siege Ballista Hierophant", className: "Templar",
      guideUrl: "https://maxroll.gg/poe/build-guides/siege-ballista-hierophant",
      description: "Turret placement build with high DPS ceiling from stacked ballista totems.",
      playstyle: "ranged",
      pros: ["Very high DPS ceiling with stacked totems", "Safe playstyle", "Ballistas deal from range", "Excellent against stationary bosses"],
      cons: ["Totems must be placed optimally", "Less mobile than other builds", "Setup time between packs"],
      engagementText: "Deploy a field of siege ballistae and let the automated artillery handle everything. Ballista Hierophant is PoE's most satisfying turret fantasy.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Sunder Ignite Elementalist", className: "Witch",
      guideUrl: "https://maxroll.gg/poe/build-guides/sunder-ignite-elementalist",
      description: "Melee ignite Elementalist with guaranteed spreading fire from every Sunder.",
      playstyle: "melee",
      pros: ["Ignite spreads to every nearby enemy", "Sunder AoE is excellent", "Elementalist amplifies all ignite", "Strong clear speed"],
      cons: ["Melee range required", "Ignite DoT takes time to kill", "Fire resistance mitigation needed"],
      engagementText: "Slam the ground and set the world on fire. Every Sunder spreads ignite to everything nearby — Elementalist Sunder turns rooms into infernos.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Poison SRS Necromancer", className: "Witch",
      guideUrl: "https://maxroll.gg/poe/build-guides/poison-srs-necromancer",
      description: "Spirit minions coated in poison for ramping DoT damage on all enemies.",
      playstyle: "summoner",
      pros: ["Poison DoT scales excellently", "SRS spirits are expendable", "Necromancer provides great auras", "Budget-friendly start"],
      cons: ["DoT requires time to kill", "SRS expires and must be recast", "Poison cap management"],
      engagementText: "Send poisoned spirits to infect everything they touch. Poison SRS Necromancer turns all enemies into walking biohazards that slowly expire.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Cyclone Slayer", className: "Duelist",
      guideUrl: "https://maxroll.gg/poe/build-guides/cyclone-slayer",
      description: "Classic Cyclone for infinite spinning and blade vortex overlapping.",
      playstyle: "melee",
      pros: ["Iconic and timeless build", "Continuous AoE spinning", "Slayer life leech", "Great at all content"],
      cons: ["Requires good weapon investment", "Less damage than meta builds", "Mana cost management"],
      engagementText: "The classic that never gets old. Cyclone Slayer spins through everything dealing massive continuous damage — PoE's favorite melee build since forever.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
  ];
  for (const b of poeBuilds) insertBuild(poeId, poeDefaultMode.id, poeS28.id, b);

  // ─ Diablo II Resurrected (15 builds) ─
  const d2rDefaultMode = createdModes["diablo-2-resurrected"]["softcore"];
  const d2rBuilds: RichBuild[] = [
    {
      name: "Blizzard Sorceress", className: "Sorceress",
      guideUrl: "https://maxroll.gg/d2/guides/blizzard-sorceress",
      description: "Fast leveling and farming with cold AoE damage and teleport mobility.",
      playstyle: "caster",
      pros: ["Excellent area clear", "Strong magic find farming", "Fast Teleport mobility", "Works with budget gear"],
      cons: ["Struggles vs Cold Immune without Infinity", "Squishy in Hell difficulty", "Teleport can be dangerous"],
      engagementText: "The queen of magic find runs. Freeze entire screens and teleport through maps faster than any other class.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Fist of the Heavens Paladin", className: "Paladin",
      guideUrl: "https://www.icy-veins.com/d2/fist-of-the-heavens-paladin-build",
      description: "Massive holy bolt damage for clearing packs of undead and demons.",
      playstyle: "caster",
      pros: ["Incredible vs undead and demons", "Holy Bolt bolts chain through packs", "Strong at Chaos Sanctuary", "Satisfying holy power theme"],
      cons: ["Limited vs non-undead targets", "Requires high mana", "Static attack range"],
      engagementText: "Call down heaven's wrath on the forces of evil. FoH Paladin turns every hell map into a divine bombardment of holy destruction.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Blessed Hammer Paladin", className: "Paladin",
      guideUrl: "https://maxroll.gg/d2/guides/blessed-hammer-paladin",
      description: "Magic damage hammers ignore immunities for versatile clearing.",
      playstyle: "melee",
      pros: ["Magic damage bypasses all immunities", "Excellent AoE coverage", "Works on every target", "Strong solo player"],
      cons: ["Hammers spiral unpredictably", "Requires positioning", "Less effective in tight spaces"],
      engagementText: "The most iconic D2 build of all time. Blessed Hammer Paladin — aka Hammerdin — is still the gold standard for a reason.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Hydra Sorceress", className: "Sorceress",
      guideUrl: "https://maxroll.gg/d2/guides/hydra-sorceress",
      description: "Ranged fire damage with hydras for bossing and area clear.",
      playstyle: "caster",
      pros: ["Hydras deal continuous fire damage", "Safe ranged playstyle", "Good for static boss fights", "Fun multi-Hydra spawning"],
      cons: ["Fire immunities in Hell", "Requires fire break items", "Hydras have limited range"],
      engagementText: "Summon a field of fire-breathing serpents that torch everything. Hydra Sorc turns every room into a fiery serpent den.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Smite Paladin", className: "Paladin",
      guideUrl: "https://www.icy-veins.com/d2/smiter-paladin-build",
      description: "Boss killer with guaranteed hits and crushing blow for Ubers.",
      playstyle: "melee",
      pros: ["Guaranteed hit on Smite", "Crushing Blow destroys Uber bosses", "Best Uber killer", "Strong vs single targets"],
      cons: ["Limited AoE capability", "Requires Uberuniqs for Ubers", "One-dimensional playstyle"],
      engagementText: "The only build made specifically to kill D2R's hardest bosses. Smiter is the Uber killer — nothing else comes close for Hell Uber grinding.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Lightning Fury Amazon", className: "Amazon",
      guideUrl: "https://maxroll.gg/d2/guides/lightning-fury-amazon",
      description: "Chain lightning javelin that bounces between enemies for massive clear.",
      playstyle: "ranged",
      pros: ["Chain lightning clears packs instantly", "Javelins provide good offense/defense", "Great against large monster groups", "Fun javazon playstyle"],
      cons: ["Requires LF charges to restock", "Expensive javelins", "Less effective on isolated targets"],
      engagementText: "Hurl lightning-charged javelins that chain between every enemy in range. Javazon has been dominating D2R ladders since Season 1.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Berserk Barbarian", className: "Barbarian",
      guideUrl: "https://maxroll.gg/d2/guides/berserk-barbarian",
      description: "Berserking physical-to-magic converter for dealing with physical immune demons.",
      playstyle: "melee",
      pros: ["Converts physical to magic damage", "Destroys physical immune enemies", "High single-target damage", "Unique immune-bypassing utility"],
      cons: ["Penalty to defense while Berserking", "Risky playstyle", "Limited AoE compared to other barbs"],
      engagementText: "Go berserk and turn your physical damage into magic to bypass every immunity. Berserk Barb solves D2R's hardest problem: physical immune demons.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Lightning Sentry Assassin", className: "Assassin",
      guideUrl: "https://maxroll.gg/d2/guides/lightning-sentry-assassin",
      description: "Trap-setting Assassin that fills areas with electrocuting Lightning Sentries.",
      playstyle: "caster",
      pros: ["Sentries deal enormous lightning damage", "Safe trap-setting playstyle", "Great pack clearing", "Unique trap gameplay loop"],
      cons: ["Lightning immunities in Hell", "Trap placement required", "High mana cost"],
      engagementText: "Electrify entire areas with automated lightning traps. Trap Assassin lets you create kill zones that nobody who enters will survive.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Summon Necromancer", className: "Necromancer",
      guideUrl: "https://maxroll.gg/d2/guides/summon-necromancer",
      description: "Army of skeletons and golems to overwhelm anything. Very safe playstyle.",
      playstyle: "summoner",
      pros: ["Enormous minion army", "Very safe — minions tank everything", "Strong at all content", "Budget-friendly starter"],
      cons: ["Slow clear compared to active builds", "Minion management required", "Iron Golem can be lost"],
      engagementText: "Command a skeleton army that overwhelms everything in its path. D2R's most iconic summoner — your undead legion cannot be stopped.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Fire Wall Sorceress", className: "Sorceress",
      guideUrl: "https://maxroll.gg/d2/guides/fire-wall-sorceress",
      description: "Immovable fire walls that enemies must walk through for constant burning damage.",
      playstyle: "caster",
      pros: ["Fire walls deal enormous damage over time", "Forces enemies to take damage walking through", "Creative strategic placement", "Very high damage ceiling"],
      cons: ["Enemies that don't walk through are safe", "Fire immunities negate everything", "Positioning intensive"],
      engagementText: "Create walls of fire that enemies MUST walk through to reach you. Fire Wall Sorc turns every encounter into a strategic deathtrap.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Frozen Orb Sorceress", className: "Sorceress",
      guideUrl: "https://maxroll.gg/d2/guides/frozen-orb-sorceress",
      description: "Classic cold build with Frozen Orb for exceptional AoE coverage.",
      playstyle: "caster",
      pros: ["Massive AoE cold coverage", "Classic and proven build", "Slows enemies on hit", "Works as second cold spec alongside Blizzard"],
      cons: ["Cold immunities in Hell", "Requires Infinity for immune maps", "Lower single-target than Blizzard"],
      engagementText: "Send spinning orbs of cold destruction through packs. Frozen Orb Sorc is the most satisfying cold build — classic, reliable, and still excellent.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Mosaic Assassin", className: "Assassin",
      guideUrl: "https://maxroll.gg/d2/guides/mosaic-assassin",
      description: "Charge-up Claws of Thunder Assassin with the Mosaic unique for incredible DPS.",
      playstyle: "melee",
      pros: ["Mosaic charges never expire", "Claws of Thunder deals insane damage", "Unique mechanics feel rewarding", "Strong in all endgame"],
      cons: ["Requires Mosaic unique claws", "Complex charge-up rotation", "Expensive end-game setup"],
      engagementText: "The build that broke D2R's balance. Mosaic Assassin with infinite thunder charges is technically the most powerful build in the game right now.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Fissure Druid", className: "Druid",
      guideUrl: "https://maxroll.gg/d2/guides/fissure-druid",
      description: "Fire elementalist Druid raining Fissure and Volcano for exceptional fire damage.",
      playstyle: "caster",
      pros: ["Fissure deals great sustained fire damage", "Volcano adds single-target power", "Unique fire druid theme", "Strong clear speed"],
      cons: ["Fire immunities in Hell", "Positioning-dependent for Fissure", "Requires fire pierce gear"],
      engagementText: "Summon fiery fissures that erupt beneath your enemies. Fissure Druid makes the earth itself attack your enemies — beautifully destructive.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Bone Spear Necromancer", className: "Necromancer",
      guideUrl: "https://www.icy-veins.com/d2/bone-spear-necromancer-build",
      description: "Physical damage bone spears that bypass all resistances for versatile bossing.",
      playstyle: "caster",
      pros: ["Bone damage bypasses all resistances", "Strong single-target bossing", "No immunity problems", "Excellent vs Diablo and Baal"],
      cons: ["Lower AoE than minion necromancer", "Mana-intensive", "Requires bone skill gear"],
      engagementText: "Launch bone spears that bypass every immunity in the game. Bone Necro trivializes D2R's toughest bosses because nothing resists physical bone damage.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Whirlwind Barbarian", className: "Barbarian",
      guideUrl: "https://maxroll.gg/d2/guides/whirlwind-barbarian",
      description: "The iconic Barbarian spinning attack with dual-wield for maximum hits.",
      playstyle: "melee",
      pros: ["Iconic, timeless build", "Excellent AoE from spinning", "Dual-wield for maximum attack speed", "Fun and simple to play"],
      cons: ["Expensive weapons needed", "Can get stuck in tight areas", "Physical immunities require backup damage"],
      engagementText: "Spin through Hell itself. Whirlwind Barbarian is THE D2 melee build — if you haven't leveled a WW Barb, have you even played D2?",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
  ];
  for (const b of d2rBuilds) insertBuild(d2rId, d2rDefaultMode.id, d2rS13.id, b);

  // ─ Diablo III (15 builds) ─
  const d3DefaultMode = createdModes["diablo-3"]["softcore"];
  const d3Builds: RichBuild[] = [
    {
      name: "Rathma Death Nova Necromancer", className: "Necromancer",
      guideUrl: "https://maxroll.gg/d3/build-guides/rathma-death-nova-necromancer",
      description: "Rathma set Necromancer spamming Death Nova for entire-screen AoE coverage.",
      playstyle: "caster",
      pros: ["Screen-wide AoE Death Nova", "Rathma set is highly optimized", "Very smooth playstyle", "Excellent Greater Rift pusher"],
      cons: ["Specific Rathma pieces required", "Cooldown dependent", "Limited mobility"],
      engagementText: "Spam Death Nova across the entire screen in an endless wave of necrotic energy. Rathma Necro is D3's current top dog for rift pushing.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "LoD Death Nova Necromancer", className: "Necromancer",
      guideUrl: "https://maxroll.gg/d3/build-guides/lod-death-nova-necromancer",
      description: "Legacy of Dreams Death Nova — budget-friendly and extremely potent.",
      playstyle: "caster",
      pros: ["No set required — budget start", "Legacy of Dreams scales without set bonuses", "Strong Death Nova output", "Flexible gearing"],
      cons: ["Lower ceiling than dedicated Rathma", "LoD gem required at high level", "Less reliable at extreme GR tiers"],
      engagementText: "Push Greater Rifts without a full ancient gear set. LoD Death Nova proves you don't need perfect gear to destroy the endgame.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Inarius Death Nova Necromancer", className: "Necromancer",
      guideUrl: "https://maxroll.gg/d3/build-guides/inarius-death-nova",
      description: "Bone armor-buffed Death Nova with Inarius set for melee range devastating damage.",
      playstyle: "caster",
      pros: ["Bone armor provides excellent defense", "Inarius buffs Death Nova significantly", "Very tanky for a caster", "Strong close-range damage"],
      cons: ["Must stay in melee range", "Bone armor stacks can be consumed quickly", "Requires full Inarius set"],
      engagementText: "Get in close and let your bone armor amplify your Death Nova into pure devastation. Inarius Necro is the tankiest caster in D3.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Trag'Oul Death Nova Necromancer", className: "Necromancer",
      guideUrl: "https://maxroll.gg/d3/build-guides/tragoul-death-nova",
      description: "Health-fueled Death Nova using Trag'Oul set for blood magic scaling.",
      playstyle: "caster",
      pros: ["Blood magic scaling is unique", "Trag'Oul set is very strong", "Health sacrifice creates huge damage", "Different feel from other Necros"],
      cons: ["Constantly managing health resource", "Risky playstyle if healing fails", "Requires specific blood skills"],
      engagementText: "Sacrifice your own blood for obscene damage. Trag'Oul Blood Nova lives on the edge — your health bar IS your damage meter.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "LoD Bone Spear Necromancer", className: "Necromancer",
      guideUrl: "https://maxroll.gg/d3/build-guides/lod-bone-spear",
      description: "Bone Spear with Legacy of Dreams for insane single-target boss damage.",
      playstyle: "caster",
      pros: ["Incredible single-target boss damage", "Bone Spear has huge range", "No set needed", "Strong elite killing"],
      cons: ["Focused on single targets", "Limited AoE spread", "Requires LoD gem investment"],
      engagementText: "Shatter bosses in seconds with concentrated bone spear barrages. LoD Bone Spear is the Necromancer's best boss-killing setup in Season 38.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "LoD Meteor Wizard", className: "Wizard",
      guideUrl: "https://maxroll.gg/d3/build-guides/lod-meteor-wizard",
      description: "Buffed meteor crashing in massive explosions with Legacy of Dreams for free gear.",
      playstyle: "caster",
      pros: ["Massive meteor explosions", "No specific set required", "LoD scaling is excellent", "Very visual and satisfying"],
      cons: ["Meteors have travel time", "Fire immunities reduce damage", "Requires high Paragon for best results"],
      engagementText: "Call down asteroid-sized meteors without any set requirement. LoD Meteor Wizard is the most explosive leveling and farming build in D3.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Firebird Meteor Wizard", className: "Wizard",
      guideUrl: "https://maxroll.gg/d3/build-guides/firebird-meteor-wizard",
      description: "Firebird set Meteor Wizard with fire damage ramping after consecutive meteor hits.",
      playstyle: "caster",
      pros: ["Firebird set provides enormous fire multiplier", "Ramping damage stacks quickly", "Excellent GR pushing", "Consistent DPS output"],
      cons: ["Requires full Firebird set", "Complex stacking mechanic", "Fire damage reduction from certain elites"],
      engagementText: "Stack fire damage until the entire screen is a nuclear inferno. Firebird Meteor Wizard has the highest fire DPS ceiling in the entire game.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Tal Rasha Meteor Wizard", className: "Wizard",
      guideUrl: "https://maxroll.gg/d3/build-guides/tal-rasha-meteor-wizard",
      description: "Four-element Tal Rasha set with Meteor stacking elemental damage bonuses.",
      playstyle: "caster",
      pros: ["Four-element damage bonuses", "Tal Rasha set is powerful", "Meteor synergizes perfectly", "Flexible element cycling"],
      cons: ["Must cycle all four elements", "Complex rotation management", "Requires all Tal Rasha pieces"],
      engagementText: "Cycle fire, cold, lightning, and arcane meteors to stack all four Tal Rasha damage bonuses simultaneously. Maximum elemental power.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Akkhan Condemn Crusader", className: "Crusader",
      guideUrl: "https://maxroll.gg/d3/build-guides/akkhan-condemn-crusader",
      description: "Holy damage Crusader using Condemn explosions from the Akkhan set.",
      playstyle: "melee",
      pros: ["Condemn explosions are massive", "Akkhan set provides Akarats Champion bonus", "Holy damage versatility", "Strong GR pushing"],
      cons: ["Requires full Akkhan set", "Cooldown management", "Akarats Champion timing"],
      engagementText: "Call down holy judgment in massive Condemn explosions. Akkhan Crusader spends half its life in Akarats Champion — and it's absolutely dominant.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Natalya Spike Trap Demon Hunter", className: "Demon Hunter",
      guideUrl: "https://maxroll.gg/d3/build-guides/natalya-spike-trap",
      description: "Natalya's set Demon Hunter placing Spike Traps that devastate elites instantly.",
      playstyle: "ranged",
      pros: ["Spike Traps deal enormous elite damage", "Natalya's set synergy", "Safe trap placement playstyle", "One-shots most elite packs"],
      cons: ["Setup time required per pack", "Less mobile than other DH builds", "Spike Trap placement needs accuracy"],
      engagementText: "Lay devastating spike traps that one-shot elite packs on sight. Natalya Spike Trap DH is the highest single-pack burst build in D3.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Marauder Sentry Demon Hunter", className: "Demon Hunter",
      guideUrl: "https://maxroll.gg/d3/build-guides/marauder-sentry",
      description: "Classic turret Demon Hunter with Marauder set and six simultaneous sentries.",
      playstyle: "ranged",
      pros: ["Six automated sentries", "Marauder set is iconic", "Very safe ranged playstyle", "Classic DH fantasy"],
      cons: ["Sentry placement management", "Less bursty than Spike Trap", "Requires full Marauder set"],
      engagementText: "The original Demon Hunter fantasy — deploy six automated turrets and let them annihilate everything. Classic for a reason.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "LoD HotA Barbarian", className: "Barbarian",
      guideUrl: "https://maxroll.gg/d3/build-guides/lod-hota-barbarian",
      description: "Hammer of the Ancients Legacy of Dreams Barbarian dealing devastating blows.",
      playstyle: "melee",
      pros: ["No set requirement", "HotA hits incredibly hard", "LoD provides flexible scaling", "Strong solo player"],
      cons: ["Single target focused", "Fury management", "Less AoE than WW builds"],
      engagementText: "Smash everything with the most powerful single hit in D3 — no ancient gear set required. LoD HotA is freedom hammer gameplay.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Raekor Boulder Toss Barbarian", className: "Barbarian",
      guideUrl: "https://maxroll.gg/d3/build-guides/raekor-boulder-toss",
      description: "Ancient Spear Boulder Toss Barbarian with Raekor set charge mechanics.",
      playstyle: "melee",
      pros: ["Boulder Toss deals massive damage", "Raekor charges provide momentum", "Unique charge gameplay loop", "Strong with good CDR"],
      cons: ["Requires charge management", "Complex Raekor interaction setup", "Specific piece requirements"],
      engagementText: "Charge into enemies and hurl massive boulders at your targets. Raekor Boulder Toss is D3's most unique Barbarian build and hits ridiculously hard.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Blessed Shield Crusader", className: "Crusader",
      guideUrl: "https://maxroll.gg/d3/build-guides/blessed-shield-crusader",
      description: "Shield-throwing Crusader with massive ricochet damage from Blessed Shield.",
      playstyle: "melee",
      pros: ["Blessed Shield ricochets between targets", "Very fun shield-throwing fantasy", "Strong area coverage", "Satisfying projectile gameplay"],
      cons: ["Ricochet can be unpredictable", "Requires shield investment", "Less effective in large open areas"],
      engagementText: "Throw your shield like a divine boomerang that bounces between enemies. Blessed Shield Crusader is the most fun projectile build in D3.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "POJ Tempest Rush Monk", className: "Monk",
      guideUrl: "https://maxroll.gg/d3/build-guides/poj-tempest-rush-monk",
      description: "Patterns of Justice set Monk sprinting through enemies with Tempest Rush.",
      playstyle: "melee",
      pros: ["Never stops moving", "Tempest Rush provides constant AoE", "POJ set is very powerful", "Fastest movement build in D3"],
      cons: ["Requires full POJ set", "Must keep moving to maintain damage", "Vulnerable when stopping"],
      engagementText: "Never stop running. POJ Tempest Rush Monk sprints through dungeons dealing AoE damage the entire time — pure kinetic destruction.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
  ];
  for (const b of d3Builds) insertBuild(d3Id, d3DefaultMode.id, d3S38.id, b);

  // ─ Grim Dawn (15 builds) ─
  const gdDefaultMode = createdModes["grim-dawn"]["softcore"];
  const gdBuilds: RichBuild[] = [
    {
      name: "Dawnbreaker Warder", className: "Warder (Soldier + Shaman)",
      guideUrl: "https://forums.crateentertainment.com/t/warder-dawnbreaker/100001",
      description: "Physical damage Warder with Dawnbreaker set and exceptional survivability.",
      playstyle: "melee",
      pros: ["Excellent physical damage", "Dawnbreaker set is powerful", "Very tanky survivability", "Strong in all game modes"],
      cons: ["Requires Dawnbreaker set", "Slow early game", "Physical damage can be resisted"],
      engagementText: "Dawn breaks on your enemies as you shatter them with physical force. Dawnbreaker Warder is Grim Dawn's most reliable endgame tank-DPS.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Brutallax Dervish", className: "Dervish (Oathkeeper + Nightblade)",
      guideUrl: "https://www.grimtools.com/calc/brutallax-dervish",
      description: "Dual-wielding Dervish with Zolhan's Technique for tremendous physical DPS.",
      playstyle: "melee",
      pros: ["Dual-wield speed is incredible", "Zolhan's Technique procs constantly", "Excellent sustained DPS", "Fun mobile melee"],
      cons: ["Requires two good weapons", "Somewhat squishy", "Complex dual-wield skill interactions"],
      engagementText: "Wield two weapons at blinding speed and destroy everything in a flurry of brutal strikes. Dervish is Grim Dawn's most aggressive melee fantasy.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Chillwhisper Reaper", className: "Reaper (Nightblade + Necromancer)",
      guideUrl: "https://www.grimtools.com/calc/chillwhisper-reaper",
      description: "Cold damage Reaper with Chillwhisper set and huge crowd control.",
      playstyle: "melee",
      pros: ["Cold damage provides excellent CC", "Chillwhisper set is powerful", "Large crowd control capability", "Strong at Shattered Realm"],
      cons: ["Cold resistance on some enemies", "Reaper requires dual-class investment", "Chillwhisper set is rare"],
      engagementText: "Freeze the entire battlefield with cold reaping strikes. Chillwhisper Reaper is Grim Dawn's most stylish cold-melee fantasy — death in ice.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Pierce RoS Blademaster", className: "Blademaster (Soldier + Nightblade)",
      guideUrl: "https://forums.crateentertainment.com/t/blademaster-pierce-ros/100002",
      description: "Ring of Steel Blademaster with full pierce damage for unrivaled boss melting.",
      playstyle: "melee",
      pros: ["Pierce damage melts bosses", "Ring of Steel is powerful", "Excellent boss killer", "Good survivability"],
      cons: ["Limited AoE compared to casters", "Requires pierce gear stack", "Boss-focused build"],
      engagementText: "Pierce through every defense your enemies have. Ring of Steel Blademaster dissects bosses with surgical precision — unstoppable in single combat.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Hellborne Shieldbreaker", className: "Shieldbreaker (Demolitionist + Oathkeeper)",
      guideUrl: "https://forums.crateentertainment.com/t/shieldbreaker-hellborne/100003",
      description: "Fire damage Shieldbreaker with Hellborne set and Grenado/Firestrike synergies.",
      playstyle: "caster",
      pros: ["Hellborne set is excellent for fire", "Grenado explosions are massive", "Firestrike sustains resources", "Strong at all difficulties"],
      cons: ["Fire resistance on Chthonians", "Hellborne set required", "Complex skill synergy setup"],
      engagementText: "Set the world on fire with demonic power. Hellborne Shieldbreaker combines grenades and holy wrath into one unstoppable hellfire machine.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Voidsoul Sentinel", className: "Sentinel (Inquisitor + Shaman)",
      guideUrl: "https://www.grimtools.com/calc/voidsoul-sentinel",
      description: "Dual elemental and void Sentinel with Rune of Hagarrad and Trozan's Sky Shard.",
      playstyle: "caster",
      pros: ["Multiple elemental damage types", "Void damage bypasses many resistances", "Strong area coverage", "Interesting skill combination"],
      cons: ["Complex multi-element management", "Expensive devotion points", "Specific unique gear needed"],
      engagementText: "Channel void and elemental forces simultaneously. Voidsoul Sentinel tears open holes in reality while raining sky shards — a force of pure chaos.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Deathguard Reaper", className: "Reaper (Nightblade + Necromancer)",
      guideUrl: "https://forums.crateentertainment.com/t/reaper-deathguard/100004",
      description: "Bleeding and poison Reaper using Deathguard set for DoT-stacking excellence.",
      playstyle: "melee",
      pros: ["DoT stacking is powerful", "Deathguard set synergizes perfectly", "Bleeding and poison stack multiplicatively", "Strong sustained damage"],
      cons: ["Requires DoT time to kill", "Deathguard set farming required", "Less burst than direct damage builds"],
      engagementText: "Leave a trail of bleeding, poisoned enemies who slowly succumb to your touch. Deathguard Reaper is the most methodical killer in Grim Dawn.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Chaos Skeletons Cabalist", className: "Cabalist (Occultist + Arcanist)",
      guideUrl: "https://forums.crateentertainment.com/t/cabalist-chaos-skele/100005",
      description: "Chaos-infused skeleton army Cabalist destroying everything in its path.",
      playstyle: "summoner",
      pros: ["Large skeleton army", "Chaos damage is versatile", "Arcanist boosts are strong", "Safe summoner playstyle"],
      cons: ["Skeletons require management", "Chaos resistance mitigates damage", "Complex dual-mastery setup"],
      engagementText: "Command a chaos-infused skeleton army while channeling arcane power. Cabalist skeletons corrupt everything they touch — the most creative summoner in GD.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Lightning Elementalist", className: "Warder (Soldier + Shaman)",
      guideUrl: "https://forums.crateentertainment.com/t/lightning-elementalist-warder/100006",
      description: "Storm-calling Warder with Savagery and Stormcaller's Pact for lightning mayhem.",
      playstyle: "melee",
      pros: ["Lightning damage has excellent chains", "Stormcaller's Pact is very powerful", "Savagery grants stacking buffs", "Strong in Ultimate difficulty"],
      cons: ["Lightning resistance on some enemies", "Stacking Savagery takes time", "Complex devotion pathing"],
      engagementText: "Call the storm and let it destroy everything around you. Lightning Warder channels nature's fury through every melee strike.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Cold Conjurer", className: "Conjurer (Occultist + Shaman)",
      guideUrl: "https://forums.crateentertainment.com/t/conjurer-cold/100007",
      description: "Cold minion Conjurer with Familiar and Briarthorn for dual-summon synergy.",
      playstyle: "summoner",
      pros: ["Dual summon synergy", "Cold CC provides safety", "Familiar is very powerful", "Unique dual-summon fantasy"],
      cons: ["Two summons require double management", "Cold resistance reduces effectiveness", "Complex summon balancing"],
      engagementText: "Command a familiar and a forest guardian simultaneously in a cold-buffed army. Conjurer is Grim Dawn's most elegant dual-summon build.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Drain Essence Vitalist", className: "Ritualist (Occultist + Shaman)",
      guideUrl: "https://forums.crateentertainment.com/t/ritualist-drain-essence/100008",
      description: "Life-draining caster Ritualist with massive sustain from Drain Essence.",
      playstyle: "caster",
      pros: ["Excellent life sustain", "Drain Essence provides consistent damage", "Strong in all difficulties", "Very safe playstyle"],
      cons: ["Channeled skill limits mobility", "Requires vita damage investment", "Less burst than other casters"],
      engagementText: "Drain the life from enemies and use it as your own. Drain Essence Vitalist never dies — it just takes everyone else's health.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Witch Hunter Poison", className: "Witch Hunter (Inquisitor + Nightblade)",
      guideUrl: "https://forums.crateentertainment.com/t/witch-hunter-poison/100009",
      description: "Acid/poison Witch Hunter stacking Lethal Assault and Venom stacks.",
      playstyle: "melee",
      pros: ["Acid and poison stack multiplicatively", "Lethal Assault is excellent", "Witch Hunter has great passives", "Strong sustained damage"],
      cons: ["Requires acid/poison gear", "DoT build time-to-kill", "Complex venom stack management"],
      engagementText: "Coat every weapon in deadly poison and watch enemies dissolve. Witch Hunter Poison turns combat into a chemistry experiment — one that always ends in death.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Fire Purifier", className: "Purifier (Demolitionist + Inquisitor)",
      guideUrl: "https://forums.crateentertainment.com/t/purifier-fire/100010",
      description: "Holy fire Purifier using Inquisitor Seals and explosive fire skills.",
      playstyle: "caster",
      pros: ["Inquisitor Seal provides excellent defense", "Fire damage is strong", "Holy fire theme is great", "Good at all content"],
      cons: ["Fire resistance on Chthonians", "Seal placement required", "Moderate mobility"],
      engagementText: "Consecrate the battlefield with holy fire. Purifier combines gunpowder and divine wrath into one incandescent killing machine.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Aether Oppressor", className: "Oppressor (Occultist + Inquisitor)",
      guideUrl: "https://forums.crateentertainment.com/t/oppressor-aether/100011",
      description: "Aether damage Oppressor combining chaos and divine forces for unique damage.",
      playstyle: "melee",
      pros: ["Unique aether damage combination", "Oppressor has strong passives", "Good defensive capabilities", "Interesting lore-wise build"],
      cons: ["Aether resistance on some enemies", "Complex dual-mastery investment", "Less straightforward than single mastery"],
      engagementText: "Combine occult chaos with inquisitor divine power for pure aether devastation. Oppressor breaks the laws of the Grim Dawn world — to your benefit.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Vitality Ritualist Army", className: "Ritualist (Occultist + Shaman)",
      guideUrl: "https://forums.crateentertainment.com/t/ritualist-vitality-army/100012",
      description: "Vitality damage army Ritualist commanding undead and briarthorns.",
      playstyle: "summoner",
      pros: ["Large, diverse minion army", "Vitality sustain keeps summons alive", "Strong in Ultimate difficulty", "Very relaxed summoner playstyle"],
      cons: ["Requires split mastery investment", "Complex minion management", "Vitality resistance sometimes mitigated"],
      engagementText: "Lead an army of vitality-infused undead and nature spirits. Vitality Ritualist Army is Grim Dawn's most varied summoner with the biggest army.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
  ];
  for (const b of gdBuilds) insertBuild(gdId, gdDefaultMode.id, null, b);

  // ─ Torchlight Infinite (15 builds) ─
  const tlDefaultMode = createdModes["torchlight-infinite"]["softcore"];
  const tlBuilds: RichBuild[] = [
    {
      name: "Youga Ember Lance", className: "Youga",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/youga-ember-lance",
      description: "Ember Lance spamming Youga with incredible single-target DPS and clear.",
      playstyle: "caster",
      pros: ["High single-target damage", "Ember Lance has good range", "Smooth progression", "Strong endgame clear"],
      cons: ["Mana management required", "Less AoE than other builds", "Requires Ember Lance skill investment"],
      engagementText: "Hurl streams of searing ember lances that pierce through everything. Youga Ember Lance is TLI's most satisfying beam-style caster.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Gemma Summon Swarm", className: "Gemma",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/gemma-swarm",
      description: "Gemma summoning and empowering a swarm of creatures for overwhelming coverage.",
      playstyle: "summoner",
      pros: ["Swarm provides excellent AoE", "Low active input needed", "Strong survivability through minions", "Fun and unique"],
      cons: ["Swarm targeting can be erratic", "Less single-target focus", "Complex empowerment mechanics"],
      engagementText: "Command a biological swarm that overwhelms entire maps. Gemma Swarm turns you into a living plague — unstoppable and omnidirectional.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Erica Blazing Storm", className: "Erica",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/erica-storm",
      description: "Elemental storm Erica summoning fire and lightning for full screen coverage.",
      playstyle: "caster",
      pros: ["Full screen elemental coverage", "Fire and lightning synergize", "Strong against groups", "Great visual effects"],
      cons: ["Complex elemental balancing", "Some targets resist certain elements", "Expensive for max performance"],
      engagementText: "Summon elemental storms that cover the entire screen simultaneously. Erica Blazing Storm turns every map into a catastrophic weather event.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Thea Phantom Blade", className: "Thea",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/thea-phantom",
      description: "Phantom blade Thea throwing spectral weapons that return for double damage.",
      playstyle: "ranged",
      pros: ["Spectral weapons deal damage twice", "Excellent range", "Great for farming", "Unique boomerang mechanic"],
      cons: ["Must wait for weapons to return", "Positioning dependent", "Less effective in cluttered areas"],
      engagementText: "Throw phantoms blades that slice through enemies on the way out AND on the way back. Thea Phantom Blade doubles every attack's damage automatically.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Rosa Frostbolt Barrage", className: "Rosa",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/rosa-frostbolt",
      description: "Ice bolt barrage Rosa freezing and shattering entire groups with cold magic.",
      playstyle: "caster",
      pros: ["Freeze provides crowd control", "Shatter mechanic deals bonus damage", "Excellent pack clearing", "Safe ranged gameplay"],
      cons: ["Cold resistance reduces effectiveness", "Requires freeze buildup", "Shatter timing-dependent"],
      engagementText: "Freeze packs solid then shatter them for explosion bonus damage. Rosa Frostbolt Barrage is the most satisfying freeze-shatter build in TLI.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Karano Shadow Strike", className: "Karano",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/karano-shadow",
      description: "Shadow step striker Karano teleporting into enemies for devastating burst.",
      playstyle: "melee",
      pros: ["Teleport strike has massive burst", "Extreme mobility", "Shadow power provides excellent bonuses", "Fun and aggressive playstyle"],
      cons: ["Very fragile when surrounded", "Requires careful positioning", "Shadow resource management"],
      engagementText: "Vanish into shadows and reappear behind enemies for instant lethal strikes. Karano Shadow Strike is TLI's most aggressive assassination fantasy.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Bing Construct Commander", className: "Bing",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/bing-construct",
      description: "Mechanical construct Bing commanding robots and turrets for automated slaughter.",
      playstyle: "summoner",
      pros: ["Constructs deal excellent damage", "Fully automated after setup", "Unique mechanical theme", "Safe ranged playstyle"],
      cons: ["Construct placement required", "Less flexible movement", "Constructs can be destroyed"],
      engagementText: "Engineer a field of mechanical killing machines that slaughter without you lifting a finger. Bing Construct Commander is TLI's best engineer fantasy.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Rehan Berserker Charge", className: "Rehan",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/rehan-berserker",
      description: "Berserker charging Rehan with overwhelming physical power and rage stacks.",
      playstyle: "melee",
      pros: ["Charge deals massive damage", "Rage stacks amplify all attacks", "Very aggressive and fun", "High damage ceiling"],
      cons: ["Squishy while charging", "Rage expires quickly", "Requires precise timing"],
      engagementText: "Build rage and unleash devastating charges that annihilate everything in your path. Rehan Berserker Charge is pure adrenaline-fueled destruction.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Iris Time Stop", className: "Iris",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/iris-timestop",
      description: "Time-manipulation Iris freezing time and dealing massive burst during stopped time.",
      playstyle: "caster",
      pros: ["Time stop is incredibly powerful", "Burst during stopped time is massive", "Unique mechanic", "Excellent boss damage"],
      cons: ["Time stop has cooldown", "Complex timing windows", "Requires specific time-gear"],
      engagementText: "Stop time itself and deal unlimited damage while enemies are frozen. Iris Time Stop is the most overpowered mechanic in all of Torchlight Infinite.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Youga Pet Army", className: "Youga",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/youga-pets",
      description: "Alternative Youga summoner build commanding a diverse elemental pet army.",
      playstyle: "summoner",
      pros: ["Diverse pet army covers all elements", "Very safe playstyle", "Strong scaling with investment", "Budget-friendly start"],
      cons: ["Complex pet management", "Less damage than active Youga builds", "Pets require specific gear to scale"],
      engagementText: "Command an elemental menagerie that covers your weaknesses. Youga Pet Army proves you're never truly alone when fighting through TLI.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Gemma Death Seal", className: "Gemma",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/gemma-death-seal",
      description: "Death Seal Gemma dealing massive AoE burst on enemies marked for death.",
      playstyle: "caster",
      pros: ["Death Seal burst is enormous", "Mark enemies for guaranteed kill", "Excellent boss damage", "Unique seal mechanic"],
      cons: ["Mark must be applied first", "Cooldown between seals", "Less consistent AoE than swarm"],
      engagementText: "Mark enemies with the death seal and watch them explode. Gemma Death Seal guarantees kills on the most powerful enemies in TLI.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Erica Crit Overload", className: "Erica",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/erica-crit",
      description: "Critical hit stacking Erica with explosive elemental crits on every hit.",
      playstyle: "caster",
      pros: ["Massive crit multipliers", "Elemental crits deal bonus damage", "Excellent single-target DPS", "High damage ceiling"],
      cons: ["Requires crit investment", "Complex crit calculations", "Expensive min-maxing"],
      engagementText: "Stack critical hits until every attack is a nuclear explosion. Erica Crit Overload makes 100% crit chance the floor, not the goal.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Thea Void Blade", className: "Thea",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/thea-void",
      description: "Void-infused blade Thea tearing holes in reality with every strike.",
      playstyle: "ranged",
      pros: ["Void damage bypasses resistance", "Dramatic visual effect", "Excellent single-target damage", "Strong endgame scaling"],
      cons: ["Void gear is expensive", "Complex void resistance interaction", "Requires specific void uniques"],
      engagementText: "Slash through reality itself with void-infused blades. Thea Void Blade tears dimensional holes in enemies — the most visually dramatic build in TLI.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Karano Poison Daggers", className: "Karano",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/karano-poison",
      description: "Poison dagger Karano stacking venom with every stab for ramping DoT.",
      playstyle: "melee",
      pros: ["Poison stacks with every hit", "High DoT ceiling", "Stealth provides safety", "Fun assassin fantasy"],
      cons: ["DoT time-to-kill", "Must stay in melee range", "Poison resistance mitigation"],
      engagementText: "Coat your blades in the deadliest venom and watch enemies slowly collapse. Karano Poison Daggers makes you the most patient and deadly assassin.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Rehan Warlord Shield", className: "Rehan",
      guideUrl: "https://maxroll.gg/torchlightinfinite/builds/rehan-shield",
      description: "Defensive warlord Rehan using shield bash and block for tanky gameplay.",
      playstyle: "melee",
      pros: ["Exceptional tankiness", "Block provides reliable mitigation", "Shield bash deals good damage", "Safe playstyle"],
      cons: ["Lower offensive power", "Slow clear compared to berserker", "Block gear required"],
      engagementText: "Become a walking fortress. Rehan Warlord Shield blocks everything the game throws at you and counters with devastating shield bashes.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
  ];
  for (const b of tlBuilds) insertBuild(tlId, tlDefaultMode.id, tlSS11.id, b);

  // ─ Destiny 2 (15 builds) ─
  const d2DefaultMode = createdModes["destiny-2"]["pve"];
  const dest2Builds: RichBuild[] = [
    {
      name: "Contraverse Hold Void Warlock", className: "Warlock",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/warlock-contraverse-void",
      description: "Literally broken Contraverse Hold Void Warlock — grenade uptime is perpetual.",
      playstyle: "caster",
      pros: ["Perpetual grenade uptime", "Void suppression is very powerful", "Excellent in endgame content", "Strong and consistent DPS"],
      cons: ["Exotic lock-in", "Less effective in ad-clear", "Requires good Discipline stat"],
      engagementText: "Throw grenades literally forever. Contraverse Hold Void Warlock is perpetual chaos — you never stop grenading and enemies never stop dying.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "GREATEST Solar Titan Build", className: "Titan",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/titan-solar",
      description: "Sunbreaker Titan with maximum Solar power and Hammer of Sol uptime.",
      playstyle: "melee",
      pros: ["Hammer of Sol is devastating", "Solar provides excellent healing", "Maximum uptime on abilities", "Strong in all activity types"],
      cons: ["Sunbreaker exotic lock-in", "Melee-range focused", "Requires Solar fragment investment"],
      engagementText: "Become a solar god hurling hammers across the battlefield. This Titan build has been top meta since Solar 3.0 dropped and shows no signs of slowing.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Shadow Hunter Void", className: "Hunter",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/hunter-void-shadow",
      description: "Void Hunter that Vanishes into shadow for devastating ambush attacks.",
      playstyle: "melee",
      pros: ["Invisibility provides massive safety", "Ambush multipliers are powerful", "Excellent in PvP too", "Smoke bomb utility"],
      cons: ["Close range required for ambush", "Less effective in open PvE", "Exotic dependent"],
      engagementText: "Disappear into shadow and reappear with a knife in an enemy's back. Void Hunter is the most assassin-like build in Destiny 2 — hunt from the dark.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Praxic Blade Void Titan", className: "Titan",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/titan-praxic-blade-void",
      description: "CRAZY Titan blade build using Praxic Fire and Void overshield for nuclear damage.",
      playstyle: "melee",
      pros: ["Praxic Fire provides insane damage", "Void overshield is very tanky", "Nuclear single-target burst", "Excellent in endgame"],
      cons: ["Praxic Fire exotic lock-in", "Overshield timing requires practice", "Limited ad-clear"],
      engagementText: "A Titan build so crazy it broke the community's collective mind. Praxic Void Titan shrugs off damage while dealing nuclear melee attacks.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Nuclear Storm Titan", className: "Titan",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/titan-nuclear-storm",
      description: "Arc Titan with thundercrash and lightning strikes providing storm coverage.",
      playstyle: "melee",
      pros: ["Thundercrash is the highest damage super", "Arc lightning provides great AoE", "Excellent team damage buff", "Fun to slam into bosses"],
      cons: ["Thundercrash requires good aim", "Expensive exotics needed", "Arc surge requires specific armor"],
      engagementText: "Become a human thunderbolt and crash into bosses for the highest super damage in the game. Nuclear Storm Titan is pure controlled lightning.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Lucky Raspberry Infinite Hunter", className: "Hunter",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/hunter-lucky-raspberry",
      description: "Infinite Arcbolt Grenade spam Hunter — the most fun Arc build in the game.",
      playstyle: "ranged",
      pros: ["Infinite grenade spam is hilarious fun", "Arc chain from grenades is excellent AoE", "Lucky Raspberry refunds grenades constantly", "Very ad-clear focused"],
      cons: ["Less boss damage than other Hunters", "Arc resists reduce effectiveness", "Lucky Raspberry exotic lock-in"],
      engagementText: "Never stop throwing grenades. Lucky Raspberry ensures your Arcbolt grenades chain endlessly — the most chaotic ad-clear build in Destiny 2.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Winter's Surge Stasis Warlock", className: "Warlock",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/warlock-stasis-surge",
      description: "Stasis Warlock with Winter's Guile freezing everything within reach.",
      playstyle: "caster",
      pros: ["Freeze is incredibly powerful CC", "Winter's Guile melee bonus is massive", "Excellent add control", "Strong in all content"],
      cons: ["Stasis can freeze your teammates", "Melee range requirement for guile", "Winter's Guile exotic slot"],
      engagementText: "Freeze everything solid and then shatter them with melee. Winter's Guile Stasis Warlock is the most cold and calculated build in D2.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Blinding Blade Arc Warlock", className: "Warlock",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/warlock-blinding-blade-arc",
      description: "Arclock build with Blinding Grenades and chain lightning buffing entire team.",
      playstyle: "caster",
      pros: ["Blinds shut down enemy attacks", "Chain lightning provides team value", "Very fun to play", "Strong in endgame content"],
      cons: ["Support-oriented — your DPS is secondary", "Arc grenade cooldown dependent", "Less effective solo"],
      engagementText: "Blind your enemies while empowering your team with chain lightning. Arc Warlock is the backbone of any endgame fireteam — the team needs you.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Void Ursa DPS Support Titan", className: "Titan",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/titan-void-ursa-support",
      description: "Bubble-providing support Titan that also deals excellent Void damage.",
      playstyle: "hybrid",
      pros: ["Bubble is the best team defensive", "Ursa Furiosa refunds super energy", "Both tanky and supportive", "Excellent raid value"],
      cons: ["Bubble can obstruct sight lines", "Support role reduces own damage", "Ursa Furiosa exotic lock-in"],
      engagementText: "Drop a divine bubble and protect your fireteam while dealing devastating Void damage yourself. Every raid needs a Ursa Titan — be the hero your team needs.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "OP Stormdancer Warlock", className: "Warlock",
      guideUrl: "https://mobalytics.gg/destiny-2/builds/warlock-stormdancer",
      description: "Stormtrance Warlock reaching astronomical damage with Stormdancer's Brace.",
      playstyle: "caster",
      pros: ["Stormtrance scales insanely with damage", "Stormdancer's Brace multiplies super damage", "Excellent solo content", "Very satisfying super"],
      cons: ["Requires stacking super time for max damage", "Stationary during Stormtrance", "Stormdancer's Brace exotic lock-in"],
      engagementText: "Stay in Stormtrance as long as possible to stack infinite damage multipliers. Stormdancer Warlock rewrites what a super can do when you don't stop it.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Infinite Supers Lawless Hunter", className: "Hunter",
      guideUrl: "https://www.youtube.com/watch?v=d2_lawless_hunter",
      description: "Season of Lawless Hunter with infinite super generation for constant Golden Gun.",
      playstyle: "ranged",
      pros: ["Infinite super uptime", "Golden Gun deals massive damage", "Season of Lawless synergies", "Excellent DPS in all content"],
      cons: ["Requires Season of Lawless gear", "Complex super regeneration loop", "Exotic slot competition"],
      engagementText: "Fire Golden Gun shots that never run out. Season of Lawless Hunter generates supers so fast you're always powered up — the ultimate DPS machine.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "God Mode Praxic Blade Titan", className: "Titan",
      guideUrl: "https://www.youtube.com/watch?v=d2_titan_praxic_god",
      description: "Unkillable Titan with max restoration and Praxic Fire for endgame content.",
      playstyle: "melee",
      pros: ["Virtually unkillable with max restoration", "Praxic Fire provides insane damage bonus", "Excellent endgame performance", "Tanky damage dealer"],
      cons: ["Very specific armor requirements", "Expensive to assemble", "Praxic Fire exotic competition"],
      engagementText: "Achieve literal god mode in Destiny 2. Praxic God Titan cannot die and deals nuclear damage simultaneously — this build breaks the game.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Mothkeeper Strand Hunter", className: "Hunter",
      guideUrl: "https://www.youtube.com/watch?v=d2_mothkeeper_hunter",
      description: "Strand Hunter using Mothkeeper Wraps for explosive grenade proliferation.",
      playstyle: "ranged",
      pros: ["Mothkeeper creates explosive proliferation", "Strand grenades bounce everywhere", "Very fun and chaotic", "Strong add control"],
      cons: ["Mothkeeper Wraps exotic lock-in", "Grenades can be unpredictable", "Less single-target focused"],
      engagementText: "Release explosive moth swarms from every grenade. Mothkeeper Strand Hunter turns every fight into a cascade of bouncing, exploding chaos.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Delicate Tomb Arc Warlock", className: "Warlock",
      guideUrl: "https://www.youtube.com/watch?v=d2_delicate_tomb",
      description: "Delicate Tomb exotic Arc Warlock with Ionic Trace synergies and ability spam.",
      playstyle: "caster",
      pros: ["Delicate Tomb creates Ionic Traces", "Ionic Traces provide ability regeneration", "Excellent ability spam", "Strong in all activities"],
      cons: ["Delicate Tomb exotic slot", "Requires ability regeneration investment", "Complex trace interaction"],
      engagementText: "Pick up Ionic Traces from every kill and unleash endless Arc abilities. Delicate Tomb Arc Warlock makes you a walking ability machine that never stops firing.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Hammer Throw Solar Titan", className: "Titan",
      guideUrl: "https://www.youtube.com/watch?v=d2_hammer_solar_titan",
      description: "Sunbreaker Titan hurling solar hammers with incandescent explosions on every kill.",
      playstyle: "melee",
      pros: ["Incandescent explosions chain to nearby enemies", "Solar hammers are very satisfying to throw", "Excellent ad-clearing", "Strong team buff potential"],
      cons: ["Range limited to thrown hammers", "Requires Solar fragment setup", "Sunbreaker exotic competition"],
      engagementText: "Throw flaming hammers that explode on kill and ignite everything nearby. Hammer Throw Solar Titan turns every kill into a chain reaction of fire.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
  ];
  for (const b of dest2Builds) insertBuild(d2Id, d2DefaultMode.id, d2SeasonLawless.id, b);

  // ─ Borderlands 3 (15 builds) ─
  const bl3DefaultMode = createdModes["borderlands-3"]["pve"];
  const bl3Builds: RichBuild[] = [
    {
      name: "Mozerker 8.0 Moze", className: "Moze",
      guideUrl: "https://www.youtube.com/watch?v=bl3_mozerker",
      description: "The legendary Mozerker build with infinite grenades and Iron Bear for Moze.",
      playstyle: "hybrid",
      pros: ["Infinite grenade loop", "Iron Bear provides tanky mech option", "Legendary status build", "Very well documented"],
      cons: ["Requires specific Mozerker gear", "Complex grenade loop setup", "Grenades may self-damage"],
      engagementText: "The Moze build that defined a generation of Borderlands players. Mozerker 8.0 throws infinite grenades while piloting Iron Bear — absolute chaos.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Khaos Queen Amara", className: "Amara",
      guideUrl: "https://www.lootlemon.com/class/siren",
      description: "Amara Phasecast build for insane elemental damage output and survivability.",
      playstyle: "melee",
      pros: ["Phasecast deals enormous elemental damage", "Strong survivability through elemental hits", "Queen-tier damage output", "Great for all content"],
      cons: ["Requires elemental focused gear", "Complex elemental interaction management", "Phasecast on cooldown creates downtime"],
      engagementText: "Rule every Vault Hunt as the Khaos Queen herself. Amara Phasecast obliterates enemies with elemental force while her fists punch reality itself.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Nuclear Revolt Zane", className: "Zane",
      guideUrl: "https://www.lootlemon.com/class/operative",
      description: "Zane with nuclear damage stacking from Double Barrel and MNTIS shoulder cannon.",
      playstyle: "ranged",
      pros: ["MNTIS cannon provides extra action", "Double Barrel stacks damage well", "Excellent damage output", "Fun and unique"],
      cons: ["Clone management required", "Requires specific Zane legendaries", "Complex skill tree pathing"],
      engagementText: "Deploy drones, clones, and shoulder cannons simultaneously. Nuclear Revolt Zane is the triple-threat Operative — three ability damage at once.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Rakk Attack FL4K", className: "FL4K",
      guideUrl: "https://www.lootlemon.com/class/beastmaster",
      description: "Perpetual Rakk Attack spam FL4K with Gamma Burst synergies.",
      playstyle: "ranged",
      pros: ["Rakks provide homing damage", "Gamma Burst synergy is powerful", "Constant ability usage", "Fun FL4K playstyle"],
      cons: ["Rakks can miss", "Gamma Burst on cooldown creates gaps", "Less effective vs fast-moving bosses"],
      engagementText: "Send an endless wave of attack rakks into every enemy pack. FL4K's beasts never stop hunting — you just point them at the enemy.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Iron Maiden Moze", className: "Moze",
      guideUrl: "https://www.lootlemon.com/class/gunner",
      description: "Iron Bear tank Moze that stays in mech permanently with unlimited fuel.",
      playstyle: "hybrid",
      pros: ["Permanent Iron Bear uptime", "Mech provides enormous damage reduction", "Strong sustained damage", "Can't be one-shot while in mech"],
      cons: ["Slow outside mech if ejected", "Requires specific Iron Bear gear", "Mech damage ceiling lower than guns"],
      engagementText: "Never leave your mech. Iron Maiden Moze has infinite Iron Bear fuel — just stay in the robot and watch everything die around you.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Fettuccine FL4K", className: "FL4K",
      guideUrl: "https://www.lootlemon.com/class/beastmaster",
      description: "Crit-stacking FL4K with Fade Away for consistent one-shotting of all content.",
      playstyle: "ranged",
      pros: ["Fade Away crit multiplier is insane", "One-shot potential on everything", "Consistent damage output", "Strong in all difficulties"],
      cons: ["Fade Away cooldown creates gaps", "Requires high crit gear", "Less effective vs immune enemies"],
      engagementText: "Use Fade Away to guarantee one-shots on even the toughest enemies. Fettuccine FL4K doesn't care how powerful your enemy is — it dies in one shot.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Fade Away Crit FL4K", className: "FL4K",
      guideUrl: "https://www.youtube.com/watch?v=bl3_fl4k_fade_away",
      description: "Critical hit FL4K that uses Fade Away as the primary damage multiplier.",
      playstyle: "ranged",
      pros: ["Fade Away guarantees critical hits", "Massive crit multiplier", "Strong boss damage window", "Simple rotation"],
      cons: ["Cooldown dependent", "Less consistent between Fade Aways", "Pet vulnerability without stealth"],
      engagementText: "Go invisible and shoot with guaranteed critical hits until everything dies. Fade Away Crit FL4K is the most straightforward DPS window build in BL3.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "Immortal Snowshoe Moze", className: "Moze",
      guideUrl: "https://www.youtube.com/watch?v=bl3_moze_immortal",
      description: "Unkillable Moze with Snowshoe shield and constant health regeneration.",
      playstyle: "hybrid",
      pros: ["Practically unkillable with Snowshoe", "Constant health regeneration", "Excellent for solo endgame", "Strong and consistent"],
      cons: ["Requires Snowshoe shield specifically", "Lower offensive output", "Movement can feel restricted"],
      engagementText: "Simply do not die. Immortal Snowshoe Moze regenerates health faster than anything can deal damage — perfect for solo True Vault Hunter Mode.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "Mortal Snowshoe Moze", className: "Moze",
      guideUrl: "https://www.youtube.com/watch?v=bl3_moze_mortal",
      description: "Glass cannon Snowshoe Moze maximizing grenade damage at the cost of all defense.",
      playstyle: "ranged",
      pros: ["Extreme grenade damage output", "Snowshoe exploits maximized", "Very high DPS ceiling", "One of the fastest farmers"],
      cons: ["Zero defense — will die to anything", "Requires perfect positioning", "Experienced players only"],
      engagementText: "Sacrifice every defense for maximum grenade explosion output. Mortal Snowshoe Moze is the glass cannon experience pushed to its absolute limit.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Stackbot Punch Moze", className: "Moze",
      guideUrl: "https://www.youtube.com/watch?v=bl3_moze_stackbot",
      description: "Action Skill punch Moze with Stackbot artifact for stacking unlimited bonuses.",
      playstyle: "melee",
      pros: ["Stackbot bonuses scale infinitely", "Action Skill punching is unique", "Extremely satisfying", "Strong with high stacks"],
      cons: ["Stack building takes time", "Melee range required", "Stacks reset on death"],
      engagementText: "Punch enemies to stack unlimited damage bonuses. Stackbot Punch Moze is the melee dream build that gets stronger with every single hit.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Mantis Cannon Zane", className: "Zane",
      guideUrl: "https://www.youtube.com/watch?v=bl3_zane_mantis",
      description: "Mantis Cannon Zane with clone and drone for unique three-body fighting style.",
      playstyle: "hybrid",
      pros: ["Clone creates perfect distraction", "MNTIS cannon provides extra damage", "Three-body fighting style is unique", "Clone absorbs damage"],
      cons: ["Complex three-skill management", "Clone can be killed", "Requires specific Zane gear"],
      engagementText: "Fight with three bodies — yourself, your clone, and your MNTIS cannon. Mantis Zane overwhelms enemies from three different directions simultaneously.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Phasecast Amara", className: "Amara",
      guideUrl: "https://www.youtube.com/watch?v=bl3_amara_phasecast",
      description: "Phasecast Amara dealing massive upfront spiritual damage on command.",
      playstyle: "caster",
      pros: ["Phasecast burst damage is enormous", "Spiritual damage ignores armor", "Strong opener against all enemies", "Clean and simple rotation"],
      cons: ["Phasecast cooldown creates gaps", "Range limitation", "Requires elemental amps for max damage"],
      engagementText: "Unleash Phasecast to deal devastating spiritual damage on command. Amara reaches through the Fade to grab enemies by the soul and annihilate them.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Digi-Clone Infinite Zane", className: "Zane",
      guideUrl: "https://www.youtube.com/watch?v=bl3_zane_digi",
      description: "Infinite clone cycling Zane that swaps places with his clone for constant buffs.",
      playstyle: "hybrid",
      pros: ["Clone swap provides constant buff uptime", "Infinite clone cycling", "Very fun and fast playstyle", "Strong damage through buffs"],
      cons: ["Clone positioning awareness required", "Clone can die in bad spots", "Complex swap timing"],
      engagementText: "Swap places with your clone so fast enemies never know which Zane to attack. Digi-Clone Infinite Zane has the highest buff uptime of any operative build.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Gamma Burst Pet FL4K", className: "FL4K",
      guideUrl: "https://www.lootlemon.com/class/beastmaster",
      description: "FL4K's Pet takes center stage with Gamma Burst radiation explosions on kills.",
      playstyle: "summoner",
      pros: ["Pet does most of the work", "Gamma Burst radiation explosions", "Very relaxed playstyle", "Excellent add control"],
      cons: ["Pet can get stuck or lost", "Radiation resistance reduces proc damage", "Less effective vs bosses"],
      engagementText: "Let your pet do all the killing while you watch. Gamma Burst Pet FL4K sends a radiation-charged beast into battle that spreads nuclear decay on every kill.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Grenadier Moze", className: "Moze",
      guideUrl: "https://www.lootlemon.com/class/gunner",
      description: "Infinite grenade Moze throwing explosives with no magazine cost constantly.",
      playstyle: "ranged",
      pros: ["Infinite grenades literally no cost", "Grenades clear entire rooms", "No reloading required", "Very fast farmer"],
      cons: ["Self-damage from grenades", "Positioning awareness required", "Requires grenade magazine glitch setup"],
      engagementText: "Throw infinite grenades with zero resource cost. Grenadier Moze found a way to remove grenade cost entirely — and now she just grenade spams forever.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
  ];
  for (const b of bl3Builds) insertBuild(bl3Id, bl3DefaultMode.id, null, b);

  // ─ Borderlands 4 (15 builds) ─
  const bl4DefaultMode = createdModes["borderlands-4"]["standard"];
  const bl4Builds: RichBuild[] = [
    {
      name: "Dead Ringer Minion Vex", className: "Vex the Siren",
      guideUrl: "https://game8.co/games/borderlands-4/archives/vex-dead-ringer-build",
      description: "Vex summons Dead Ringer minions that replicate her spells for double damage.",
      playstyle: "summoner",
      pros: ["Minions replicate spells automatically", "Double effective spell casting", "Unique Vex Siren mechanics", "Strong scaling"],
      cons: ["Minion positioning dependency", "Complex spell replication setup", "Requires Dead Ringer exclusive gear"],
      engagementText: "Summon spell-replicating minions that double your Siren power. Dead Ringer Vex makes you twice as powerful with half the input.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Incarnate Bleed Vex", className: "Vex the Siren",
      guideUrl: "https://game8.co/games/borderlands-4/archives/vex-bleed-build",
      description: "Vex causes Incandescence bleed effects that stack for massive DoT scaling.",
      playstyle: "caster",
      pros: ["Bleed stacks multiplicatively", "Incandescence provides unique DoT", "Strong sustained damage", "Excellent against tanky enemies"],
      cons: ["DoT time-to-kill", "Bleed builds require specific mods", "Less instant satisfaction"],
      engagementText: "Apply stacking bleeds that multiply into catastrophic damage over time. Incarnate Bleed Vex watches enemies slowly crumble beneath her Siren curse.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Peacebreaker Ricochet Rafa", className: "Rafa the Exo-Soldier",
      guideUrl: "https://game8.co/games/borderlands-4/archives/rafa-peacebreaker",
      description: "Rafa's Peacebreaker rounds ricochet off walls and enemies for surprising damage.",
      playstyle: "ranged",
      pros: ["Ricochet hits enemies behind cover", "Peacebreaker rounds deal high damage", "Creative use of geometry", "Excellent in enclosed spaces"],
      cons: ["Ricochet pattern unpredictable", "Less effective in open areas", "Requires geometry awareness"],
      engagementText: "Bounce bullets around corners and into enemies who thought they were safe. Peacebreaker Ricochet Rafa makes every wall your personal deflector.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Peacebreaker Overdrive Rafa", className: "Rafa the Exo-Soldier",
      guideUrl: "https://game8.co/games/borderlands-4/archives/rafa-overdrive",
      description: "Overdrive mode Rafa activating Peacebreaker for turbo attack speed and damage.",
      playstyle: "ranged",
      pros: ["Overdrive provides insane attack speed", "Peacebreaker multiplies damage", "Excellent burst window", "Very satisfying turbo mode"],
      cons: ["Overdrive cooldown dependent", "Requires specific Overdrive gear", "Less consistent outside burst window"],
      engagementText: "Activate Overdrive and turn Peacebreaker into a bullet hose of destruction. Rafa Overdrive fires so fast enemies don't have time to react.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Scourge Cryo Amon", className: "Amon the Forgeknight",
      guideUrl: "https://game8.co/games/borderlands-4/archives/amon-cryo-scourge",
      description: "Amon cryo forging — Scourge ability freezes clusters of enemies solid.",
      playstyle: "melee",
      pros: ["Freeze provides crowd control", "Scourge hits multiple frozen enemies", "Excellent CC and damage combo", "Fun mechanic"],
      cons: ["Cryo resistance reduces effectiveness", "Must freeze before Scourge for max damage", "Limited single-target focus"],
      engagementText: "Freeze enemies with cryo forging and shatter them with Scourge. Amon turns the forge into an ice factory — and then breaks everything out of it.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Calamity Incendiary Amon", className: "Amon the Forgeknight",
      guideUrl: "https://game8.co/games/borderlands-4/archives/amon-incendiary",
      description: "Calamity Amon with forge-heat incendiary damage amplification on all weapons.",
      playstyle: "melee",
      pros: ["Forge-heat amplifies all weapons", "Incendiary spreading on kills", "Calamity provides massive burst", "Strong sustained damage"],
      cons: ["Fire resistance reduces damage", "Calamity cooldown management", "Requires incendiary weapon collection"],
      engagementText: "Superheat your forge and set everything ablaze. Calamity Incendiary Amon turns every weapon into a flamethrower — the whole world burns.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Flux Generator Harlowe", className: "Harlowe the Gravitar",
      guideUrl: "https://game8.co/games/borderlands-4/archives/harlowe-flux",
      description: "Gravity Flux Generator Harlowe suspending enemies for critical vulnerability.",
      playstyle: "caster",
      pros: ["Suspension creates critical vulnerability", "Flux Generator provides great AoE control", "Unique gravity mechanic", "Strong endgame damage"],
      cons: ["Complex gravity manipulation", "Requires specific Harlowe gear", "Less mobile during generator use"],
      engagementText: "Suspend enemies in gravity flux and make them critically vulnerable. Harlowe Flux Generator turns physics itself into a weapon against your enemies.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "CHROMA Status Harlowe", className: "Harlowe the Gravitar",
      guideUrl: "https://game8.co/games/borderlands-4/archives/harlowe-chroma",
      description: "CHROMA ability Harlowe applying all status effects simultaneously for maxed procs.",
      playstyle: "caster",
      pros: ["All status effects simultaneously", "Maximum proc potential", "CHROMA covers all elemental bases", "Unique multi-element approach"],
      cons: ["Complex status interaction management", "Requires CHROMA mastery", "Enemies can resist some elements"],
      engagementText: "Apply every status effect at once and let them synergize into catastrophic damage. CHROMA Harlowe is the rainbow of destruction — all elements, all at once.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Shock Spear Wrathfall Amon", className: "Amon the Forgeknight",
      guideUrl: "https://www.youtube.com/watch?v=bl4_amon_shock",
      description: "Electric spear Amon with Wrathfall meteor calling for devastating ground zeroes.",
      playstyle: "melee",
      pros: ["Electric spear chains between enemies", "Wrathfall meteor delivers massive burst", "Excellent AoE coverage", "Satisfying meteor calling"],
      cons: ["Wrathfall cooldown dependent", "Positioning for meteor required", "Requires electric damage gear"],
      engagementText: "Call down electric meteors while your spear electrocutes everything nearby. Wrathfall Amon combines ground and sky attacks into one electrifying package.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Gunboy Card Totem C4SH", className: "C4SH the Rogue",
      guideUrl: "https://mobalytics.gg/borderlands-4/builds/c4sh-gunboy-card-totem",
      description: "C4SH drops card totems that summon GUNBOY turrets for automated slaughter.",
      playstyle: "summoner",
      pros: ["GUNBOY turrets are automated killers", "Card totems have good placement range", "Unique card mechanic", "Excellent map clearing"],
      cons: ["Totems must be placed strategically", "GUNBOY can be destroyed", "Card resource management"],
      engagementText: "Flip cards that summon autonomous GUNBOY turrets. C4SH Card Totem turns every fight into a machine-gun fortress of automated carnage.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "CR4SH No-Reload C4SH", className: "C4SH the Rogue",
      guideUrl: "https://mobalytics.gg/borderlands-4/builds/c4sh-no-reload",
      description: "Infinite magazine C4SH build that never needs to reload — just infinite fire.",
      playstyle: "ranged",
      pros: ["Never reloads — infinite fire", "Constant damage output", "Very simple and effective", "Excellent for new players"],
      cons: ["Lower per-bullet damage", "Requires specific no-reload mods", "Less burst than reload builds"],
      engagementText: "Hold down the trigger and never let go. CR4SH No-Reload C4SH found a way to never reload — just infinite bullets, forever.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Infini-Crit Harlowe", className: "Harlowe the Gravitar",
      guideUrl: "https://www.youtube.com/watch?v=bl4_harlowe_crit",
      description: "Critical hit stacking Harlowe with gravity manipulation exposing weak points.",
      playstyle: "ranged",
      pros: ["Gravity exposes critical weak points", "Infinite crit scaling potential", "Consistent critical hit output", "Excellent endgame DPS"],
      cons: ["Complex gravity + crit interaction", "Requires high crit investment", "Expensive to perfectly gear"],
      engagementText: "Use gravity to expose every enemy's weakest point and hit it for infinite crits. Harlowe Infini-Crit makes weak spots disappear and damage skyrocket.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Ultimate Crit Vex", className: "Vex the Siren",
      guideUrl: "https://www.youtube.com/watch?v=bl4_vex_ultimate_crit",
      description: "Maximum critical hit Vex using Siren powers to expose enemy critical points.",
      playstyle: "caster",
      pros: ["Siren powers expose all critical points", "Maximum crit multiplier", "Strong endgame capability", "Very high damage ceiling"],
      cons: ["Requires extensive Siren tree investment", "Complex crit exposure mechanics", "Specific exotic gear required"],
      engagementText: "Use Siren powers to reveal every enemy's critical weakness simultaneously. Ultimate Crit Vex sees your enemy's soul — and shoots it directly.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Incendiary Slugger Amon", className: "Amon the Forgeknight",
      guideUrl: "https://www.youtube.com/watch?v=bl4_amon_slugger",
      description: "Heavy melee Amon with Forgeknight amplification turning all strikes incendiary.",
      playstyle: "melee",
      pros: ["Heavy strikes deal massive damage", "Incendiary amplifies every hit", "Forgeknight bonuses are powerful", "Tanky and aggressive"],
      cons: ["Slow heavy attacks", "Fire resistance mitigation", "Requires Forgeknight specific gear"],
      engagementText: "Strike with the force of a Forgeknight and set everything on fire. Incendiary Slugger Amon hits so hard flames spontaneously erupt from the impact.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "GUNBOY Totem C4SH", className: "C4SH the Rogue",
      guideUrl: "https://www.youtube.com/watch?v=bl4_c4sh_gunboy_totem",
      description: "C4SH's signature GUNBOY card summoning — let the totem do all the work.",
      playstyle: "summoner",
      pros: ["GUNBOY handles everything automatically", "Signature C4SH playstyle", "Excellent passive damage", "Great for resource management"],
      cons: ["Dependent on totem placement", "GUNBOY has limited range", "Requires positioning awareness"],
      engagementText: "Drop the GUNBOY card and let automated chaos handle everything. C4SH's signature build is pure delegation — summon GUNBOY, walk away, collect loot.",
      difficulty: "beginner", budgetLevel: "budget",
    },
  ];
  for (const b of bl4Builds) insertBuild(bl4Id, bl4DefaultMode.id, null, b);

  // ─ Fallout 4 (15 builds) ─
  const fo4DefaultMode = createdModes["fallout-4"]["normal"];
  const fo4Builds: RichBuild[] = [
    {
      name: "Stealth Sniper", className: "Rifleman",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-sniper-build",
      description: "Maximum sneak Sniper with scoped rifles and one-shot potential from stealth.",
      playstyle: "ranged",
      pros: ["One-shot potential from stealth", "Very safe ranged playstyle", "Sneak attack multiplier is huge", "Excellent for exploration"],
      cons: ["Limited effectiveness in tight spaces", "VATS accuracy important", "Requires Agility investment"],
      engagementText: "Become the invisible death that nobody sees coming. Stealth Sniper deletes enemies from maximum range before they know you exist.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Melee Brawler", className: "Melee",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-melee-build",
      description: "High STR melee fighter using Power Fist and Blitz for teleport-kill combos.",
      playstyle: "melee",
      pros: ["Blitz VATS teleportation is incredible", "Power Fist deals enormous damage", "Very fun and aggressive", "Great for exploration"],
      cons: ["Close range required", "Takes significant damage from ranged enemies", "Agility and STR heavy investment"],
      engagementText: "Teleport to enemies through VATS and punch them to death before they react. Melee Brawler turns Fallout 4 into a martial arts action game.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Settlement Commander", className: "Diplomat",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-settlement-build",
      description: "Charisma and settlement management build for resource empire building.",
      playstyle: "hybrid",
      pros: ["Massive resource income from settlements", "Companion loyalty bonuses", "Unique gameplay experience", "Strong in late game"],
      cons: ["Weak in combat without weapons", "Settlement management is time-consuming", "Requires Charisma investment"],
      engagementText: "Build a Commonwealth empire while talking your way out of every fight. Settlement Commander is Fallout 4's true endgame — economic and political domination.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Explosives Expert", className: "Heavy Weapons",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-explosives-build",
      description: "Demolition Expert perks for throwing grenades and mines at everything.",
      playstyle: "ranged",
      pros: ["Explosives deal massive AoE damage", "Demolition Expert multiplier", "Effective against every enemy type", "Very fun destruction"],
      cons: ["Self-damage risk with explosives", "Ammunition weight is heavy", "Grenades can miss at range"],
      engagementText: "Turn everything into a war zone. Explosives Expert throws Fallout 4's biggest explosives at every problem until the problem goes away. Loudly.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Gunslinger", className: "Pistol",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-pistol-build",
      description: "Nimble Gunslinger with powerful pistols and maximum VATS accuracy.",
      playstyle: "ranged",
      pros: ["Excellent VATS AP cost on pistols", "High fire rate", "Strong with legendary pistols", "Mobile combat style"],
      cons: ["Lower range than rifles", "Pistols need legendary rolls", "Less effective vs power armor enemies"],
      engagementText: "Quick-draw pistols and paint every enemy in VATS before pulling the trigger. Gunslinger is Fallout 4's fastest and most cinematic combat build.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Power Armor Heavy", className: "Heavy",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-power-armor-build",
      description: "Minigun-toting Power Armor warrior who ignores all damage entirely.",
      playstyle: "melee",
      pros: ["Virtually invulnerable in Power Armor", "Minigun shreds everything", "No need for stealth or strategy", "Fun power fantasy"],
      cons: ["Power Armor requires fusion cores", "Very slow movement speed", "Fusion cores are expensive"],
      engagementText: "Wear a nuclear-powered suit and walk through anything that tries to stop you. Power Armor Heavy ignores all game mechanics through sheer brutality.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "Luck VATS Commando", className: "Automatic",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-vats-build",
      description: "Maximum Luck VATS build with automatic weapons and critical hit cycling.",
      playstyle: "ranged",
      pros: ["Critical hits cycle very fast", "Maximum Luck provides crits constantly", "Automatic weapons deal excellent DPS", "Very satisfying VATS critical chain"],
      cons: ["AP management required", "Less effective outside VATS", "Luck investment displaces combat stats"],
      engagementText: "Stack maximum Luck and cycle critical hits endlessly in VATS slow motion. Luck VATS Commando turns every fight into a perfectly choreographed bullet ballet.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Rifleman Marksman", className: "Rifle",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-rifleman-build",
      description: "Long-range Rifleman with Commando perks for scoped rifle excellence.",
      playstyle: "ranged",
      pros: ["Excellent long-range combat", "Versatile rifle options", "Strong with legendary rifles", "Works in all combat situations"],
      cons: ["Less effective in close quarters", "Requires good rifle legendary rolls", "Moderate stealth required"],
      engagementText: "Equip the best scope in the Commonwealth and pick off enemies from distances they can't even comprehend. The Rifleman is Fallout 4's default power build.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Stealth Melee Ninja", className: "Melee",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-ninja-build",
      description: "Invisible melee killer combining Sneak Attack with bladed weapon multipliers.",
      playstyle: "melee",
      pros: ["Enormous stealth attack multiplier", "Blades have great DPS", "Ninja perk multiplies everything", "Very high single-target damage"],
      cons: ["Requires stealth investment", "Can't handle crowds easily", "Detection ruins the build"],
      engagementText: "Combine stealth and blades for the highest single-hit multiplier in Fallout 4. Ninja Stealth Melee one-shots enemies so fast they don't register they're dead.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Sniper Headshot Specialist", className: "Sniper",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-sniper-specialist",
      description: "Specialized headshot precision sniper taking out enemies from maximum range.",
      playstyle: "ranged",
      pros: ["Headshot multipliers are devastating", "Maximum engagement range", "One-shot potential on most enemies", "Highly satisfying precision kills"],
      cons: ["Requires SPECIAL investment", "Less effective in close quarters", "Ammunition can run low"],
      engagementText: "One bullet, one kill, infinite distance. Sniper Headshot Specialist is for players who want to turn Fallout into a precision marksmanship simulator.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Unarmed Brawler", className: "Unarmed",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-unarmed-build",
      description: "Iron Fist maxed unarmed build dealing incredible bare-knuckle devastation.",
      playstyle: "melee",
      pros: ["Iron Fist provides massive unarmed damage", "No weapon maintenance required", "High Strength scaling", "Unique no-weapon fantasy"],
      cons: ["No ranged options", "Must engage every enemy at melee range", "Extremely close range required"],
      engagementText: "Punch Deathclaws with your bare hands and win. Max Iron Fist Unarmed Brawler is Fallout 4's most absurdly satisfying power fantasy.",
      difficulty: "advanced", budgetLevel: "budget",
    },
    {
      name: "Charisma Diplomat", className: "Speech",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-charisma-build",
      description: "Maximum charisma build for persuading, intimidating, and pacifying enemies.",
      playstyle: "hybrid",
      pros: ["Pacify mechanic is incredibly powerful", "Maximum companion loyalty", "Unique non-combat gameplay", "Best for roleplay experience"],
      cons: ["Requires backup combat for unkillable enemies", "Limited effectiveness in some quests", "Very stat-specialized"],
      engagementText: "Talk your way through the apocalypse. Charisma Diplomat makes enemies fight for you, lovers out of enemies, and turns the hardest game into a conversation.",
      difficulty: "intermediate", budgetLevel: "budget",
    },
    {
      name: "Spray n Pray Commando", className: "Automatic",
      guideUrl: "https://www.reddit.com/r/fo4/comments/best_commando_build",
      description: "Automatic weapon specialist using Spray n Pray for explosive rounds on everything.",
      playstyle: "ranged",
      pros: ["Explosive rounds on every bullet", "Spray n Pray is a legendary weapon", "Excellent AoE damage", "Very fun and chaotic"],
      cons: ["Self-damage from explosions", "Requires Spray n Pray SMG", "Ammo consumption is high"],
      engagementText: "Make every bullet an explosion with Spray n Pray. Commando fires so many explosive rounds that enemy squads evaporate before they can return fire.",
      difficulty: "beginner", budgetLevel: "mid-range",
    },
    {
      name: "VATS Tactician", className: "VATS",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-vats-tactics",
      description: "VATS chaining specialist cycling through critical hits perpetually in slow motion.",
      playstyle: "ranged",
      pros: ["VATS cycling provides near-perfect accuracy", "Critical hits deal huge damage", "Slow-motion shooting is satisfying", "Good with any weapon type"],
      cons: ["VATS AP pool management", "Less effective without AP regeneration gear", "Specific SPECIAL investment"],
      engagementText: "Live in VATS slow-motion and cycle critical hits like a machine. VATS Tactician turns every fight into a perfectly executed action sequence.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Nuke Launcher", className: "Heavy Weapons",
      guideUrl: "https://www.hacktheminotaur.com/fallout-4-heavy-weapons-build",
      description: "Demolitions expert with Fat Man and Missile Launcher for room-clearing explosions.",
      playstyle: "ranged",
      pros: ["Fat Man is THE room-clearer", "Missile Launcher handles anything Fat Man misses", "Absolute devastation on large targets", "Very satisfying explosions"],
      cons: ["Mini-nuke ammunition is rare", "Self-damage is lethal", "Requires Heavy Weapons investment"],
      engagementText: "Equip a tactical nuke launcher and stop treating problems like problems. Nuke Launcher solves every situation with the appropriate amount of explosion.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
  ];
  for (const b of fo4Builds) insertBuild(fo4Id, fo4DefaultMode.id, null, b);

  // ─ Crimson Desert (15 builds) ─
  const cdDefaultMode = createdModes["crimson-desert"]["pve"];
  const cdBuilds: RichBuild[] = [
    {
      name: "Savage Samurai Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_samurai",
      description: "Katana-wielding Kliff with blazing fast attacks and lethal samurai combos.",
      playstyle: "melee",
      pros: ["Lightning-fast katana combos", "Highly mobile attack patterns", "Lethal burst damage", "Aesthetically incredible"],
      cons: ["Timing-intensive combo system", "Fragile without defensive investment", "High skill ceiling"],
      engagementText: "Become the deadliest samurai in Crimson Desert with lightning-fast katana combos. Savage Samurai Kliff is pure martial mastery — untouchable and lethal.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Unga Bunga Behemoth Oongka", className: "Oongka",
      guideUrl: "https://www.youtube.com/watch?v=cd_oongka_behemoth",
      description: "Oongka wielding a massive club and hitting everything with overwhelming brute force.",
      playstyle: "melee",
      pros: ["Massive club has huge AoE", "Brute force overcomes all obstacles", "Very tanky playstyle", "Extremely fun to play"],
      cons: ["Very slow attack animations", "Limited mobility", "Simple but effective only"],
      engagementText: "BONK. Oongka swings a club the size of a tree and rearranges the geography. Unga Bunga Behemoth is Crimson Desert's most hilariously effective build.",
      difficulty: "beginner", budgetLevel: "budget",
    },
    {
      name: "Supernatural Melee Monk Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_monk",
      description: "Martial arts Kliff with supernatural speed and precision combo attacks.",
      playstyle: "melee",
      pros: ["Supernatural speed is incredible", "Precision combos deal multiplied damage", "Very mobile and fluid", "Unique monk aesthetic"],
      cons: ["High precision required", "Complex combo memorization", "Less AoE than other builds"],
      engagementText: "Move faster than eyes can follow and strike with supernatural precision. Monk Kliff is the most technically demanding — and most rewarding — build in Crimson Desert.",
      difficulty: "expert", budgetLevel: "endgame",
    },
    {
      name: "Dual Fireworks Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_fireworks",
      description: "Twin-wielding explosive Kliff creating firework-like detonations with each strike.",
      playstyle: "ranged",
      pros: ["Dual-wielding provides incredible speed", "Explosive detonations are spectacular", "Great AoE coverage", "Very visually impressive"],
      cons: ["Dual weapon management complex", "Explosive radius can self-damage", "Requires two matching weapons"],
      engagementText: "Fight like a fireworks display — explosive, colorful, and absolutely beautiful. Dual Fireworks Kliff turns combat into a deadly light show.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Critical Cannon Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_cannon",
      description: "High critical rate Kliff with cannon-like power on charged attacks.",
      playstyle: "ranged",
      pros: ["Cannon-level power on crits", "Charged attacks deal enormous damage", "High critical rate multiplier", "Excellent boss damage"],
      cons: ["Long charge time for maximum damage", "Requires perfect timing", "Less effective on mobile enemies"],
      engagementText: "Charge up and fire with the force of a cannon. Critical Cannon Kliff's perfect-time charged shots one-shot bosses when executed correctly.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Boss Slayer Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_boss_slayer",
      description: "Specialized boss killing Kliff with focused burst damage windows.",
      playstyle: "melee",
      pros: ["Optimized specifically for bosses", "Burst damage windows are massive", "Very reliable damage output", "Excellent for story progression"],
      cons: ["Less effective in mob clears", "Burst window timing required", "One-dimensional"],
      engagementText: "Build Kliff specifically to obliterate every boss in the game. Boss Slayer optimization means every major encounter becomes a controlled demolition.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Lightning Mecha Spear Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_lightning_spear",
      description: "Electric spear Kliff channeling lightning through each mechanical thrust.",
      playstyle: "melee",
      pros: ["Lightning chains between nearby enemies", "Spear provides excellent reach", "Mechanical aesthetic is cool", "Strong sustained electric DPS"],
      cons: ["Lightning resistance on some enemies", "Spear animations are committed", "Requires electric damage investment"],
      engagementText: "Channel lightning through a mechanical spear and electrocute everything in range. Lightning Mecha Spear Kliff is electricity and steel in perfect lethal harmony.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
    {
      name: "Shaman 2-Hander Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_shaman",
      description: "Spiritual two-handed Kliff drawing power from shamanic connection to elements.",
      playstyle: "melee",
      pros: ["Two-handed weapons hit devastatingly hard", "Shamanic bonuses provide elemental buffs", "Spiritual connection gives passive bonuses", "Strong and thematic"],
      cons: ["Two-hander attack speed is slow", "Shamanic buff maintenance", "Requires specific shamanic gear"],
      engagementText: "Draw power from the spirits and channel it through a two-handed weapon of destruction. Shaman Kliff fights with ancient power no enemy can understand.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Thunder Witch Lightning Orbs Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_thunder_witch",
      description: "Ranged lightning orb Kliff with thunderous detonations on impact.",
      playstyle: "caster",
      pros: ["Lightning orbs have excellent range", "Thunderous detonations are powerful", "Unique ranged Kliff option", "Great for keeping distance"],
      cons: ["Orb travel time requires leading", "Lightning resistance reduces damage", "Less effective in close combat"],
      engagementText: "Hurl lightning orbs that detonate with thunderous force across the battlefield. Thunder Witch Kliff proves you can be a caster even as a warrior.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Kinetic Burst Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_kinetic",
      description: "Kinetic energy releasing Kliff with charged burst attacks for mass stagger.",
      playstyle: "melee",
      pros: ["Charge releases massive kinetic burst", "Stagger precludes enemy attacks", "AoE burst coverage", "Good crowd control"],
      cons: ["Charge-up leaves vulnerable period", "Burst requires enemies to be grouped", "Less sustained damage than other builds"],
      engagementText: "Build kinetic charge with every movement and release it in devastating bursts. Kinetic Burst Kliff controls every fight's momentum — literally.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Purple Magic Fist Kliff", className: "Kliff",
      guideUrl: "https://www.youtube.com/watch?v=cd_kliff_purple_fist",
      description: "Dark magic-channeling Kliff punching with supernatural purple energy fists.",
      playstyle: "melee",
      pros: ["Purple magic energy enhances every punch", "Supernatural damage type is unique", "Excellent close combat", "Visually spectacular"],
      cons: ["Magic fist range is limited", "Requires dark magic investment", "Less range than weapon builds"],
      engagementText: "Punch reality itself with dark magic-powered fists. Purple Magic Fist Kliff channels the void into every strike — the most dramatic melee build in Crimson Desert.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Raging Lightning Oongka", className: "Oongka",
      guideUrl: "https://www.youtube.com/watch?v=cd_oongka_lightning",
      description: "Oongka calling lightning storms from the sky while charging enemies.",
      playstyle: "caster",
      pros: ["Lightning storm provides excellent AoE", "Charging while calling storms is unique", "Combines physical and magic damage", "Surprising for a melee character"],
      cons: ["Lightning control is complex for Oongka", "Storm timing requires practice", "Lightning resistance reduces sky damage"],
      engagementText: "Charge into melee while calling lightning storms from above. Raging Lightning Oongka is the most surprising combination in Crimson Desert — all brawn, all storm.",
      difficulty: "advanced", budgetLevel: "expensive",
    },
    {
      name: "Elemental Blade Kliff", className: "Kliff",
      guideUrl: "https://www.lootlemon.com/crimson-desert/kliff",
      description: "Multi-element blade Kliff cycling fire, ice, and lightning for maximum versatility.",
      playstyle: "melee",
      pros: ["Multi-element covers all resistances", "Excellent versatility", "Cycle elements to maximize damage", "No enemy is immune"],
      cons: ["Complex element cycling management", "Requires multiple element investments", "Not specialized enough for high damage"],
      engagementText: "Cycle fire, ice, and lightning on every strike to overcome any resistance. Elemental Blade Kliff has no elemental weakness — and exploits all of yours.",
      difficulty: "intermediate", budgetLevel: "mid-range",
    },
    {
      name: "Abyssal Lich Spear Kliff", className: "Kliff",
      guideUrl: "https://www.lootlemon.com/crimson-desert/kliff-abyssal",
      description: "Dark abyssal energy spear Kliff with lifesteal and undead summoning synergies.",
      playstyle: "melee",
      pros: ["Lifesteal sustains through any fight", "Abyssal energy is unique damage type", "Undead synergies provide additional DPS", "Very tanky with lifesteal"],
      cons: ["Complex abyssal/undead synergy setup", "Requires abyssal gear specifically", "Less burst than pure damage builds"],
      engagementText: "Drain life with every spear thrust while commanding undead servants. Abyssal Lich Spear Kliff sustains infinitely by stealing life from everything it kills.",
      difficulty: "advanced", budgetLevel: "endgame",
    },
    {
      name: "Optimal Crit Spear Kliff", className: "Kliff",
      guideUrl: "https://www.reddit.com/r/CrimsonDesert/comments/kliff_crit_spear",
      description: "Maximum critical rate spear build optimized for consistent one-shot potential.",
      playstyle: "ranged",
      pros: ["Optimized for maximum critical rate", "Consistent one-shot potential", "Spear range is excellent", "Community-proven optimization"],
      cons: ["Requires extensive crit gear farming", "Critical RNG can still fail", "One-dimensional damage type"],
      engagementText: "Community-optimized to achieve near-100% critical rate with spear. Optimal Crit Spear is the mathematically perfect Kliff build — every hit counts maximum.",
      difficulty: "intermediate", budgetLevel: "expensive",
    },
  ];
  for (const b of cdBuilds) insertBuild(cdId, cdDefaultMode.id, null, b);

  // ── Build Sources (reference directory) ──
  const buildSourceData = [
    { name: "Maxroll Last Epoch", type: "website", url: "https://maxroll.gg/last-epoch/build-guides", gameId: createdGames["last-epoch"].id },
    { name: "Maxroll Diablo 4", type: "website", url: "https://maxroll.gg/d4/build-guides", gameId: createdGames["diablo-4"].id },
    { name: "Maxroll D2R", type: "website", url: "https://maxroll.gg/d2/guides", gameId: createdGames["diablo-2-resurrected"].id },
    { name: "Maxroll D3", type: "website", url: "https://maxroll.gg/d3/tier-list", gameId: createdGames["diablo-3"].id },
    { name: "Icy Veins Diablo 4", type: "website", url: "https://www.icy-veins.com/d4/tier-list", gameId: createdGames["diablo-4"].id },
    { name: "Mobalytics PoE 2", type: "website", url: "https://mobalytics.gg/poe-2/builds", gameId: createdGames["path-of-exile-2"].id },
    { name: "YouTube - Boardman21", type: "youtube_channel", url: "https://www.youtube.com/@Boardman21", gameId: createdGames["last-epoch"].id },
    { name: "YouTube - Maxroll", type: "youtube_channel", url: "https://www.youtube.com/@MaxrollGG", gameId: null },
    { name: "YouTube - Subtractem", type: "youtube_channel", url: "https://www.youtube.com/@Subtractem", gameId: createdGames["last-epoch"].id },
    { name: "YouTube - Raxxanterax", type: "youtube_channel", url: "https://www.youtube.com/@raaborern", gameId: null },
    { name: "Reddit r/LastEpoch", type: "reddit", url: "https://www.reddit.com/r/LastEpoch", gameId: createdGames["last-epoch"].id },
    { name: "Reddit r/diablo4", type: "reddit", url: "https://www.reddit.com/r/diablo4", gameId: createdGames["diablo-4"].id },
    { name: "Reddit r/pathofexile2", type: "reddit", url: "https://www.reddit.com/r/PathOfExile2", gameId: createdGames["path-of-exile-2"].id },
  ];
  for (const s of buildSourceData) {
    storage.createBuildSource({ name: s.name, type: s.type, url: s.url, gameId: s.gameId, isActive: true });
  }

  // ── Social Accounts ──
  storage.createSocialAccount({ platform: "twitter", accountName: "@BuildTier", accountUrl: "https://twitter.com/BuildTier", isActive: true });
  storage.createSocialAccount({ platform: "instagram", accountName: "buildtier_official", accountUrl: "https://instagram.com/buildtier_official", isActive: true });
  storage.createSocialAccount({ platform: "tiktok", accountName: "@buildtier", accountUrl: "https://tiktok.com/@buildtier", isActive: false });
  storage.createSocialAccount({ platform: "youtube", accountName: "BuildTier", accountUrl: "https://youtube.com/@BuildTier", isActive: false });
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

  // IMPORTANT: static routes must come before /:slug to avoid conflict
  app.get("/api/games/featured", (req, res) => {
    const allGames = storage.getGames();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const scored = allGames.map(game => {
      const allBuilds = db.all(sql`SELECT id, upvotes, downvotes, created_at FROM builds WHERE game_id = ${game.id}`) as any[];
      const newBuildsThisWeek = allBuilds.filter(b => b.created_at >= weekAgo).length;
      const totalVotesThisWeek = allBuilds.filter(b => b.created_at >= weekAgo).reduce((sum: number, b: any) => sum + b.upvotes + b.downvotes, 0);
      const totalBuilds = allBuilds.length;
      const activityScore = (newBuildsThisWeek * 3) + (totalVotesThisWeek * 1) + (totalBuilds * 0.5);
      let rotationBonus = 0;
      if (!game.lastFeaturedAt) {
        rotationBonus = 50;
      } else {
        const daysSince = (Date.now() - new Date(game.lastFeaturedAt).getTime()) / (1000 * 60 * 60 * 24);
        rotationBonus = Math.min(daysSince * 5, 100);
      }
      return { ...game, activityScore: activityScore + rotationBonus };
    });

    scored.sort((a, b) => b.activityScore - a.activityScore);
    const feat = scored[0];
    const trending = scored.slice(1, 4);
    if (feat) db.run(sql`UPDATE games SET last_featured_at = ${now} WHERE id = ${feat.id}`);

    const enrichGame = (g: any) => {
      const classes = storage.getGameClasses(g.id);
      const activeSeasons = storage.getSeasonsByGame(g.id).filter(s => s.isActive);
      const modes = storage.getGameModes(g.id);
      const buildCount = (db.all(sql`SELECT count(*) as c FROM builds WHERE game_id = ${g.id}`) as any[])[0]?.c ?? 0;
      return { ...g, classes, activeSeasons, modes, buildCount };
    };
    res.json({ featured: feat ? enrichGame(feat) : null, trending: trending.map(enrichGame) });
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

  // Trending builds
  app.get("/api/builds/trending", (req, res) => {
    res.json(storage.getTrendingBuilds());
  });

  // Viral builds
  app.get("/api/builds/viral", (req, res) => {
    res.json(storage.getViralBuilds());
  });

  app.get("/api/builds/:id", (req, res) => {
    const build = storage.getBuild(parseInt(req.params.id));
    if (!build) return res.status(404).json({ error: "Build not found" });
    // Increment view count
    db.run(sql`UPDATE builds SET views = COALESCE(views, 0) + 1 WHERE id = ${parseInt(req.params.id)}`);
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

  // ── Social metrics ──
  app.patch("/api/builds/:id/social", (req, res) => {
    const { adminUserId, socialScore, socialViews, socialShares, isTrending, isViral, trendingReason } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateBuildSocialMetrics(parseInt(req.params.id), {
      socialScore, socialViews, socialShares, isTrending, isViral, trendingReason,
    });
    if (!updated) return res.status(404).json({ error: "Build not found" });
    res.json(updated);
  });

  // ── Bookmarks ──
  app.post("/api/builds/:id/bookmark", (req, res) => {
    const buildId = parseInt(req.params.id);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = storage.toggleBookmark(buildId, userId);
    res.json({ ...result, bookmarkCount: storage.getBookmarkCount(buildId) });
  });

  app.post("/api/builds/:id/anon-bookmark", (req, res) => {
    const buildId = parseInt(req.params.id);
    const voterHash = getVoterHash(req, res);
    const result = storage.toggleAnonBookmark(buildId, voterHash);
    res.json({ ...result, bookmarkCount: storage.getBookmarkCount(buildId), voterHash });
  });

  app.get("/api/builds/:id/bookmark-count", (req, res) => {
    res.json({ count: storage.getBookmarkCount(parseInt(req.params.id)) });
  });

  app.get("/api/bookmarks/user/:userId", (req, res) => {
    res.json(storage.getUserBookmarks(parseInt(req.params.userId)));
  });

  app.get("/api/bookmarks/anon/:voterHash", (req, res) => {
    res.json(storage.getAnonBookmarks(req.params.voterHash));
  });

  // ── Reports ──
  app.post("/api/builds/:id/report", (req, res) => {
    const buildId = parseInt(req.params.id);
    const voterHash = getVoterHash(req, res);
    const reason = req.body.reason || "inappropriate";
    const report = storage.createReport(buildId, voterHash, reason);
    res.json(report);
  });

  app.get("/api/admin/reports", (req, res) => {
    const { adminUserId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    res.json(storage.getReports());
  });

  app.delete("/api/admin/reports/:id", (req, res) => {
    const reportId = parseInt(req.params.id);
    const { adminUserId } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteReport(reportId);
    res.json({ success: true });
  });

  app.delete("/api/admin/builds/:id", (req, res) => {
    const buildId = parseInt(req.params.id);
    const { adminUserId } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const build = storage.getBuild(buildId);
    if (!build) return res.status(404).json({ error: "Build not found" });
    storage.deleteBuild(buildId);
    res.json({ success: true });
  });

  // ── Categories ──
  app.get("/api/categories", (req, res) => {
    res.json(storage.getCategories());
  });

  app.post("/api/categories", (req, res) => {
    const { adminUserId, name, slug, icon, sortOrder } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const cat = storage.createCategory({ name, slug, icon: icon || "🎮", sortOrder: sortOrder || 0 });
    res.status(201).json(cat);
  });

  app.patch("/api/categories/:id", (req, res) => {
    const { adminUserId, name, slug, icon, sortOrder } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateCategory(parseInt(req.params.id), { name, slug, icon, sortOrder });
    if (!updated) return res.status(404).json({ error: "Category not found" });
    res.json(updated);
  });

  app.delete("/api/categories/:id", (req, res) => {
    const { adminUserId } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteCategory(parseInt(req.params.id));
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

  // ── Build Sources (admin reference directory) ──

  app.get("/api/admin/sources", (req, res) => {
    const { adminUserId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    res.json(storage.getBuildSources());
  });

  app.post("/api/admin/sources", (req, res) => {
    const { adminUserId, ...data } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const source = storage.createBuildSource({
      name: data.name,
      type: data.type,
      url: data.url,
      gameId: data.gameId || null,
      isActive: data.isActive !== false,
    });
    res.json(source);
  });

  app.patch("/api/admin/sources/:id", (req, res) => {
    const { adminUserId, ...data } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateBuildSource(parseInt(req.params.id), data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/admin/sources/:id", (req, res) => {
    const { adminUserId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteBuildSource(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Social Accounts ──

  app.get("/api/admin/social-accounts", (req, res) => {
    const { adminUserId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    res.json(storage.getSocialAccounts());
  });

  app.post("/api/admin/social-accounts", (req, res) => {
    const { adminUserId, ...data } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const account = storage.createSocialAccount({
      platform: data.platform,
      accountName: data.accountName,
      accountUrl: data.accountUrl || null,
      isActive: data.isActive !== false,
    });
    res.json(account);
  });

  app.patch("/api/admin/social-accounts/:id", (req, res) => {
    const { adminUserId, ...data } = req.body;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    const updated = storage.updateSocialAccount(parseInt(req.params.id), data);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/admin/social-accounts/:id", (req, res) => {
    const { adminUserId } = req.query;
    const admin = storage.getUserById(parseInt(adminUserId as string));
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });
    storage.deleteSocialAccount(parseInt(req.params.id));
    res.json({ ok: true });
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

  // ── Tier Votes ──

  const VALID_TIERS = ["S+", "S", "A", "B", "C", "D"];

  app.post("/api/builds/:id/tier-vote", (req, res) => {
    const buildId = parseInt(req.params.id);
    const { tierVote, userId } = req.body;

    if (!VALID_TIERS.includes(tierVote)) {
      return res.status(400).json({ error: "Invalid tier vote" });
    }

    const build = storage.getBuild(buildId);
    if (!build) return res.status(404).json({ error: "Build not found" });

    const voterHash = getVoterHash(req, res);

    if (userId) {
      // Logged-in user
      const existing = storage.getTierVote(buildId, userId);
      if (existing && existing.tierVote === tierVote) {
        // Toggle off (same tier = remove)
        storage.removeTierVote(buildId, userId);
        const dist = storage.getVoteDistribution(buildId);
        const updatedBuild = storage.getBuild(buildId);
        return res.json({ build: updatedBuild, distribution: { ...dist, total: updatedBuild!.tierVoteCount, median: updatedBuild!.calculatedTier }, action: "removed" });
      }
      storage.castTierVote(buildId, userId, tierVote);
    } else {
      // Anonymous voter
      const existing = storage.getAnonTierVote(buildId, voterHash);
      if (existing && existing.tierVote === tierVote) {
        storage.removeAnonTierVote(buildId, voterHash);
        const dist = storage.getVoteDistribution(buildId);
        const updatedBuild = storage.getBuild(buildId);
        return res.json({ build: updatedBuild, distribution: { ...dist, total: updatedBuild!.tierVoteCount, median: updatedBuild!.calculatedTier }, action: "removed", voterHash });
      }
      storage.castAnonTierVote(buildId, voterHash, tierVote);
    }

    const dist = storage.getVoteDistribution(buildId);
    const updatedBuild = storage.getBuild(buildId);
    res.json({
      build: updatedBuild,
      distribution: { ...dist, total: updatedBuild!.tierVoteCount, median: updatedBuild!.calculatedTier },
      action: "voted",
      voterHash,
    });
  });

  app.get("/api/builds/:id/vote-distribution", (req, res) => {
    const buildId = parseInt(req.params.id);
    const build = storage.getBuild(buildId);
    if (!build) return res.status(404).json({ error: "Build not found" });
    const dist = storage.getVoteDistribution(buildId);
    res.json({ ...dist, total: build.tierVoteCount, median: build.calculatedTier });
  });

  app.get("/api/my-tier-votes", (req, res) => {
    const { userId } = req.query;
    const voterHash = getVoterHash(req, res);
    if (userId) {
      const votes = storage.getUserTierVotes(parseInt(userId as string));
      return res.json(votes.map(v => ({ buildId: v.buildId, tierVote: v.tierVote })));
    }
    const anonVotes = storage.getAnonTierVotes(voterHash);
    res.json(anonVotes.map(v => ({ buildId: v.buildId, tierVote: v.tierVote })));
  });

  // ── Legacy Vote endpoints (kept for backward compat) ──

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
    // Migrate anon bookmarks + tier votes
    storage.migrateAnonBookmarks(voterHash, user.id);
    storage.migrateAnonTierVotes(voterHash, user.id);

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
    // Migrate anon bookmarks + tier votes
    storage.migrateAnonBookmarks(voterHash, user.id);
    storage.migrateAnonTierVotes(voterHash, user.id);

    const refreshed = storage.getUserById(user.id);
    const { passwordHash, ...safe } = refreshed || user;
    res.json(safe);
  });

  app.get("/api/users/:id", (req, res) => {
    const user = storage.getUserById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safe } = user;
    const userBuilds = storage.getUserBuilds(user.id);
    const bookmarksCount = storage.getUserBookmarks(user.id).length;
    res.json({ ...safe, builds: userBuilds, bookmarksCount });
  });

  app.get("/api/users/top/leaderboard", (req, res) => {
    const topUsers = storage.getTopUsers(20);
    res.json(topUsers.map(({ passwordHash, ...u }) => u));
  });

  app.patch("/api/auth/password", (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "userId, currentPassword, and newPassword required" });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: "New password must be at least 4 characters" });
    }
    const user = storage.getUserById(parseInt(userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const newHash = hashPwd(newPassword);
    storage.updatePassword(user.id, newHash);
    res.json({ ok: true });
  });

  app.patch("/api/users/:id", (req, res) => {
    const userId = parseInt(req.params.id);
    const { bio, avatarEmoji } = req.body;
    const updated = storage.updateUser(userId, { bio, avatarEmoji });
    if (!updated) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safe } = updated;
    // Migrate anon bookmarks on any user update (triggers on login context too)
    res.json(safe);
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
  const tiers: Record<string, any[]> = {
    "S+": [], "S": [], "A": [], "B": [], "C": [], "D": [], "N": []
  };

  for (const build of allBuilds) {
    const tier = build.calculatedTier || build.calculated_tier || "N";
    if (tiers[tier]) {
      tiers[tier].push({ ...build, tier });
    } else {
      tiers["N"].push({ ...build, tier: "N" });
    }
  }

  // Sort within each tier by tierVoteCount descending (more votes = higher confidence)
  for (const tier of Object.keys(tiers)) {
    tiers[tier].sort((a, b) => (b.tierVoteCount || b.tier_vote_count || 0) - (a.tierVoteCount || a.tier_vote_count || 0));
  }

  return tiers;
}
