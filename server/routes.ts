import type { Express } from "express";
import type { Server } from "http";
import { storage, verifyPassword, detectSource } from "./storage";
import { insertBuildSchema, insertSeasonSchema, insertGameSchema, insertGameClassSchema } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { extractBuildFromUrl } from "./extract";
import crypto from "crypto";

// ─── Voter hash helper ─────────────────────────────────────────

function getVoterHash(req: any): string {
  const ip = req.headers["x-forwarded-for"] || req.ip || "unknown";
  const ua = req.headers["user-agent"] || "";
  return crypto.createHash("sha256").update(`${ip}:${ua}`).digest("hex").slice(0, 32);
}

// ─── DB init ───────────────────────────────────────────────────

function initDB() {
  // Games
  db.run(sql`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#d4a537',
    icon TEXT NOT NULL DEFAULT '⚔️',
    category TEXT NOT NULL DEFAULT 'arpg',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
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

  // Builds (updated schema)
  db.run(sql`CREATE TABLE IF NOT EXISTS builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL DEFAULT 1,
    game_class_id INTEGER,
    season_id INTEGER,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    mastery TEXT NOT NULL DEFAULT '',
    game_mode TEXT NOT NULL DEFAULT 'softcore',
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

  // Seed if empty
  const gameCount = db.all(sql`SELECT count(*) as c FROM games`);
  // @ts-ignore
  if (gameCount[0]?.c === 0) seedData();
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

  // ── Games ──
  const gamesData = [
    { slug: "last-epoch", name: "Last Epoch", color: "#d4a537", icon: "⚔️", category: "arpg", sortOrder: 100 },
    { slug: "diablo-4", name: "Diablo IV", color: "#b91c1c", icon: "💀", category: "arpg", sortOrder: 95 },
    { slug: "path-of-exile-2", name: "Path of Exile 2", color: "#c2410c", icon: "🔥", category: "arpg", sortOrder: 90 },
    { slug: "path-of-exile", name: "Path of Exile", color: "#9c6522", icon: "🌑", category: "arpg", sortOrder: 85 },
    { slug: "diablo-2-resurrected", name: "Diablo II Resurrected", color: "#7c3aed", icon: "☠️", category: "arpg", sortOrder: 80 },
    { slug: "diablo-3", name: "Diablo III", color: "#1d4ed8", icon: "🏹", category: "arpg", sortOrder: 75 },
    { slug: "grim-dawn", name: "Grim Dawn", color: "#6b7280", icon: "🌿", category: "arpg", sortOrder: 70 },
    { slug: "torchlight-infinite", name: "Torchlight Infinite", color: "#0891b2", icon: "🔦", category: "arpg", sortOrder: 65 },
    { slug: "destiny-2", name: "Destiny 2", color: "#1e3a5f", icon: "🚀", category: "looter-shooter", sortOrder: 60 },
    { slug: "borderlands-3", name: "Borderlands 3", color: "#f59e0b", icon: "💥", category: "looter-shooter", sortOrder: 55 },
    { slug: "borderlands-4", name: "Borderlands 4", color: "#d97706", icon: "💥", category: "looter-shooter", sortOrder: 50 },
    { slug: "fallout-4", name: "Fallout 4", color: "#4d7c0f", icon: "☢️", category: "other", sortOrder: 40 },
    { slug: "crimson-desert", name: "Crimson Desert", color: "#991b1b", icon: "🗡️", category: "other", sortOrder: 35 },
  ];

  const createdGames: Record<string, any> = {};
  for (const g of gamesData) {
    createdGames[g.slug] = storage.createGame({
      slug: g.slug, name: g.name, color: g.color, icon: g.icon,
      category: g.category as any, isActive: true, sortOrder: g.sortOrder,
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
  for (const name of ["Barbarian", "Necromancer", "Sorcerer", "Druid", "Rogue", "Spiritborn"]) {
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
  ];
  for (const c of poe2Classes) {
    storage.createGameClass({ gameId: poe2Id, name: c.name, masteries: JSON.stringify(c.masteries), color: "#c2410c" });
  }

  // Path of Exile classes
  for (const name of ["Duelist", "Marauder", "Ranger", "Shadow", "Templar", "Witch", "Scion"]) {
    storage.createGameClass({ gameId: poeId, name, masteries: "[]", color: "#9c6522" });
  }

  // Diablo II Resurrected
  for (const name of ["Amazon", "Necromancer", "Barbarian", "Sorceress", "Paladin", "Druid", "Assassin"]) {
    storage.createGameClass({ gameId: d2rId, name, masteries: "[]", color: "#7c3aed" });
  }

  // Diablo III
  for (const name of ["Barbarian", "Crusader", "Demon Hunter", "Monk", "Necromancer", "Witch Doctor", "Wizard"]) {
    storage.createGameClass({ gameId: d3Id, name, masteries: "[]", color: "#1d4ed8" });
  }

  // Grim Dawn
  for (const name of ["Soldier", "Demolitionist", "Occultist", "Nightblade", "Arcanist", "Shaman", "Inquisitor", "Necromancer", "Oathkeeper"]) {
    storage.createGameClass({ gameId: gdId, name, masteries: "[]", color: "#6b7280" });
  }

  // Torchlight Infinite
  for (const name of ["Berserker", "Divineshot", "Elementalist", "Frostfire", "Gemini", "Moto", "Spacetime Witness"]) {
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
  storage.createGameClass({ gameId: bl4Id, name: "TBD", masteries: "[]", color: "#d97706" });

  // Fallout 4 (playstyle-based)
  for (const name of ["Survival", "Stealth", "Heavy Gunner", "Sniper"]) {
    storage.createGameClass({ gameId: fo4Id, name, masteries: "[]", color: "#4d7c0f" });
  }

  // Crimson Desert
  storage.createGameClass({ gameId: cdId, name: "Macduff", masteries: "[]", color: "#991b1b" });

  // ── Last Epoch Seasons ──
  const s4 = storage.createSeason({ gameId: leId, slug: "le-s4", name: "Season 4 — Shattered Omens", patch: "1.4", isActive: true, sortOrder: 5 });
  const s3 = storage.createSeason({ gameId: leId, slug: "le-s3", name: "Season 3 — Beneath Ancient Skies", patch: "1.3", isActive: true, sortOrder: 4 });
  const s2 = storage.createSeason({ gameId: leId, slug: "le-s2", name: "Season 2 — Tombs of the Erased", patch: "1.2", isActive: true, sortOrder: 3 });
  const s1 = storage.createSeason({ gameId: leId, slug: "le-s1", name: "Season 1 — Harbingers of Ruin", patch: "1.1", isActive: true, sortOrder: 2 });
  storage.createSeason({ gameId: leId, slug: "le-release", name: "Release (1.0)", patch: "1.0", isActive: true, sortOrder: 1 });

  // ── Seed Builds (Last Epoch) ──
  const seedBuilds = [
    { name: "Smite Hammerdin", className: "Sentinel", mastery: "Paladin", seasonId: s4.id, gameMode: "softcore", playstyle: "melee", description: "Classic Paladin build using Smite and Hammer Throw for massive AoE clear. Extremely tanky with Holy Aura providing party-wide buffs.", mainSkills: '["Smite","Hammer Throw","Holy Aura","Lunge","Sigils of Hope"]', guideUrl: "https://www.lastepochtools.com/builds/hammerdin-smite", submitterId: boardman.id, up: 342, down: 18 },
    { name: "Runic Invocation Caster", className: "Mage", mastery: "Runemaster", seasonId: s4.id, gameMode: "softcore", playstyle: "caster", description: "High damage caster using Runic Invocation combos. Amazing clear speed and burst.", mainSkills: '["Runic Invocation","Flame Ward","Teleport","Frost Claw","Lightning Blast"]', guideUrl: "https://www.youtube.com/watch?v=abc123", submitterId: perry.id, up: 298, down: 22 },
    { name: "Falconer DoT", className: "Rogue", mastery: "Falconer", seasonId: s4.id, gameMode: "softcore", playstyle: "ranged", description: "Devastating DoT build using Falconry and aerial attacks. Great boss killing with high mobility.", mainSkills: '["Falconry","Dive Bomb","Aerial Assault","Smoke Bomb","Net"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/falconer-dot", submitterId: lizard.id, up: 275, down: 15 },
    { name: "Summoner Necromancer", className: "Acolyte", mastery: "Necromancer", seasonId: s4.id, gameMode: "softcore", playstyle: "summoner", description: "Army of the dead build. Summon skeletons and wraiths to obliterate everything. Very relaxed playstyle.", mainSkills: '["Summon Skeleton","Summon Wraith","Dread Shade","Transplant","Bone Curse"]', guideUrl: "https://www.lastepochtools.com/builds/necro-summon", submitterId: mcfluffin.id, up: 256, down: 30 },
    { name: "Storm Shaman", className: "Primalist", mastery: "Shaman", seasonId: s4.id, gameMode: "softcore", playstyle: "caster", description: "Totem-enhanced storm caster. Maelstrom and Gathering Storm create devastating lightning combos.", mainSkills: '["Maelstrom","Gathering Storm","Tornado","Tempest Strike","Fury Leap"]', guideUrl: "https://www.youtube.com/watch?v=storm456", submitterId: trem.id, up: 231, down: 25 },
    { name: "Void Knight Erasing Strike", className: "Sentinel", mastery: "Void Knight", seasonId: s4.id, gameMode: "softcore", playstyle: "melee", description: "Void-powered melee with massive echoed hits. One of the highest single-target DPS builds in the game.", mainSkills: '["Void Cleave","Anomaly","Lunge","Devouring Orb","Rebuke"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/void-knight-erasing", submitterId: epoch.id, up: 210, down: 19 },
    { name: "Spellblade Surge", className: "Mage", mastery: "Spellblade", seasonId: s4.id, gameMode: "softcore", playstyle: "hybrid", description: "Melee-caster hybrid using Surge and Enchant Weapon for explosive combos. Fast and satisfying gameplay loop.", mainSkills: '["Surge","Enchant Weapon","Flame Ward","Mana Strike","Firebrand"]', guideUrl: "https://www.lastepochtools.com/builds/spellblade-surge", submitterId: boardman.id, up: 198, down: 32 },
    { name: "Warlock Chaos", className: "Acolyte", mastery: "Warlock", seasonId: s4.id, gameMode: "softcore", playstyle: "caster", description: "Chaos bolt spam with amazing sustain. Profane Veil makes you nearly unkillable while pumping damage.", mainSkills: '["Chaos Bolts","Profane Veil","Chthonic Fissure","Transplant","Infernal Shade"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/warlock-chaos", submitterId: mcfluffin.id, up: 175, down: 28 },
    // Hardcore
    { name: "Forge Guard Tank", className: "Sentinel", mastery: "Forge Guard", seasonId: s4.id, gameMode: "hardcore", playstyle: "melee", description: "The ultimate HC tank. Ring of Shields + Manifest Armor for insane survivability. Slow but virtually unkillable.", mainSkills: '["Ring of Shields","Manifest Armor","Forge Strike","Rive","Vengeance"]', guideUrl: "https://www.youtube.com/watch?v=hctank1", submitterId: boardman.id, up: 189, down: 8 },
    { name: "Paladin Block HC", className: "Sentinel", mastery: "Paladin", seasonId: s4.id, gameMode: "hardcore", playstyle: "melee", description: "Max block Paladin with incredible sustain. Sigils of Hope provide constant healing.", mainSkills: '["Smite","Sigils of Hope","Holy Aura","Lunge","Judgement"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/paladin-block-hc", submitterId: lizard.id, up: 167, down: 5 },
    // S3
    { name: "Sorcerer Meteor", className: "Mage", mastery: "Sorcerer", seasonId: s3.id, gameMode: "softcore", playstyle: "caster", description: "Classic meteor build updated for S3. Rain fire from the sky with enormous AoE.", mainSkills: '["Meteor","Flame Ward","Teleport","Focus","Frost Wall"]', guideUrl: "https://www.youtube.com/watch?v=meteor3", submitterId: boardman.id, up: 412, down: 25 },
    { name: "Javelin Paladin", className: "Sentinel", mastery: "Paladin", seasonId: s3.id, gameMode: "softcore", playstyle: "ranged", description: "Javelin throwing Paladin with incredible range and damage. One of the best builds of S3.", mainSkills: '["Javelin","Smite","Holy Aura","Sigils of Hope","Lunge"]', guideUrl: "https://www.lastepochtools.com/builds/javelin-paladin-s3", submitterId: trem.id, up: 380, down: 20 },
    { name: "Skeleton Mage Army", className: "Acolyte", mastery: "Necromancer", seasonId: s3.id, gameMode: "softcore", playstyle: "summoner", description: "Skeleton mage variant focusing on ranged minions. Sit back and watch them destroy everything.", mainSkills: '["Summon Skeleton","Bone Curse","Dread Shade","Transplant","Spirit Plague"]', guideUrl: "https://www.lastepochtools.com/builds/skeleton-mage-army", submitterId: mcfluffin.id, up: 310, down: 18 },
    // S2
    { name: "Bladedancer Shadow", className: "Rogue", mastery: "Bladedancer", seasonId: s2.id, gameMode: "softcore", playstyle: "melee", description: "Lightning-fast melee assassin. Shadow Cascade and Dancing Strikes for incredible clear speed.", mainSkills: '["Shadow Cascade","Dancing Strikes","Shift","Smoke Bomb","Lethal Mirage"]', guideUrl: "https://www.youtube.com/watch?v=blade789", submitterId: trem.id, up: 188, down: 20 },
    { name: "Druid Bear Form HC", className: "Primalist", mastery: "Druid", seasonId: s2.id, gameMode: "hardcore", playstyle: "melee", description: "Werebear transformation for massive HP pool. Simple and effective for HC.", mainSkills: '["Werebear Form","Earthquake","Fury Leap","Entangling Roots","Maelstrom"]', guideUrl: "https://www.youtube.com/watch?v=druidhc2", submitterId: epoch.id, up: 138, down: 10 },
  ];

  for (const b of seedBuilds) {
    const { up, down, ...buildData } = b;
    const created = storage.createBuild({ ...buildData, gameId: leId } as any);
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
      const buildCount = (db.all(sql`SELECT count(*) as c FROM builds WHERE game_id = ${g.id}`) as any[])[0]?.c ?? 0;
      return { ...g, classes, activeSeasons, buildCount };
    });
    res.json(result);
  });

  app.get("/api/games/:slug", (req, res) => {
    const game = storage.getGameBySlug(req.params.slug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    const classes = storage.getGameClasses(game.id);
    const activeSeasons = storage.getSeasonsByGame(game.id).filter(s => s.isActive);
    const buildCount = (db.all(sql`SELECT count(*) as c FROM builds WHERE game_id = ${game.id}`) as any[])[0]?.c ?? 0;
    res.json({ ...game, classes, activeSeasons, buildCount });
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
    const { seasonId, gameMode, className, mastery } = req.query;
    res.json(storage.getBuilds({
      gameId: game.id,
      seasonId: seasonId ? parseInt(seasonId as string) : undefined,
      gameMode: gameMode as string | undefined,
      className: className as string | undefined,
      mastery: mastery as string | undefined,
    }));
  });

  app.get("/api/games/:gameSlug/tier-list", (req, res) => {
    const game = storage.getGameBySlug(req.params.gameSlug);
    if (!game) return res.status(404).json({ error: "Game not found" });
    const { seasonId, gameMode } = req.query;
    const allBuilds = storage.getBuilds({
      gameId: game.id,
      seasonId: seasonId ? parseInt(seasonId as string) : undefined,
      gameMode: gameMode as string | undefined,
    });
    res.json(buildTierList(allBuilds));
  });

  // Legacy tier-list (for backwards compatibility)
  app.get("/api/tier-list", (req, res) => {
    const { seasonId, gameMode, gameSlug } = req.query;
    let gameId: number | undefined;
    if (gameSlug) {
      const g = storage.getGameBySlug(gameSlug as string);
      gameId = g?.id;
    }
    const allBuilds = storage.getBuilds({
      gameId,
      seasonId: seasonId ? parseInt(seasonId as string) : undefined,
      gameMode: gameMode as string | undefined,
    });
    res.json(buildTierList(allBuilds));
  });

  app.get("/api/builds/:id", (req, res) => {
    const build = storage.getBuild(parseInt(req.params.id));
    if (!build) return res.status(404).json({ error: "Build not found" });
    res.json(build);
  });

  app.post("/api/builds", (req, res) => {
    const voterHash = getVoterHash(req);
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

    res.status(201).json(storage.getBuild(build.id));
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

    const voterHash = getVoterHash(req);
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
    res.json({ voterHash: getVoterHash(req) });
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

    const voterHash = getVoterHash(req);
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

    const voterHash = getVoterHash(req);
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
