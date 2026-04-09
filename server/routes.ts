import type { Express } from "express";
import type { Server } from "http";
import { storage, verifyPassword, detectSource } from "./storage";
import { insertBuildSchema, insertSeasonSchema } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

// ─── DB init ───────────────────────────────────────────────────

function initDB() {
  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    karma INTEGER NOT NULL DEFAULT 0,
    build_submissions INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    patch TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    mastery TEXT NOT NULL,
    season_id INTEGER NOT NULL,
    game_mode TEXT NOT NULL,
    playstyle TEXT NOT NULL,
    description TEXT NOT NULL,
    main_skills TEXT NOT NULL,
    guide_url TEXT NOT NULL,
    source_type TEXT NOT NULL,
    submitter_id INTEGER NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique ON votes(build_id, user_id)`);

  // Seed if empty
  const userCount = db.all(sql`SELECT count(*) as c FROM users`);
  // @ts-ignore
  if (userCount[0]?.c === 0) seedData();
}

function seedData() {
  // ── Admin user ──
  const admin = storage.createUser({ username: "admin", passwordHash: "admin123" });
  db.run(sql`UPDATE users SET is_admin = 1 WHERE id = ${admin.id}`);

  // ── Community users with various karma levels ──
  const boardman = storage.createUser({ username: "Boardman21", passwordHash: "pass123" });
  const perry = storage.createUser({ username: "Perrythepig", passwordHash: "pass123" });
  const lizard = storage.createUser({ username: "LizardIRL", passwordHash: "pass123" });
  const mcfluffin = storage.createUser({ username: "McFluffin", passwordHash: "pass123" });
  const trem = storage.createUser({ username: "Trem", passwordHash: "pass123" });
  const epoch = storage.createUser({ username: "Epoch_Builds", passwordHash: "pass123" });
  const tunklab = storage.createUser({ username: "Tunklab", passwordHash: "pass123" });
  const cookbook = storage.createUser({ username: "CookBook", passwordHash: "pass123" });

  // Set karma levels to simulate established community
  db.run(sql`UPDATE users SET karma = 1250 WHERE id = ${boardman.id}`);
  db.run(sql`UPDATE users SET karma = 890 WHERE id = ${perry.id}`);
  db.run(sql`UPDATE users SET karma = 720 WHERE id = ${lizard.id}`);
  db.run(sql`UPDATE users SET karma = 540 WHERE id = ${mcfluffin.id}`);
  db.run(sql`UPDATE users SET karma = 480 WHERE id = ${trem.id}`);
  db.run(sql`UPDATE users SET karma = 350 WHERE id = ${epoch.id}`);
  db.run(sql`UPDATE users SET karma = 280 WHERE id = ${tunklab.id}`);
  db.run(sql`UPDATE users SET karma = 195 WHERE id = ${cookbook.id}`);

  // ── Seasons ──
  const s4 = storage.createSeason({ slug: "s4", name: "Season 4 — Shattered Omens", patch: "1.4", isActive: true, sortOrder: 5 });
  const s3 = storage.createSeason({ slug: "s3", name: "Season 3 — Beneath Ancient Skies", patch: "1.3", isActive: true, sortOrder: 4 });
  const s2 = storage.createSeason({ slug: "s2", name: "Season 2 — Tombs of the Erased", patch: "1.2", isActive: true, sortOrder: 3 });
  const s1 = storage.createSeason({ slug: "s1", name: "Season 1 — Harbingers of Ruin", patch: "1.1", isActive: true, sortOrder: 2 });
  const rel = storage.createSeason({ slug: "release", name: "Release (1.0)", patch: "1.0", isActive: true, sortOrder: 1 });

  // ── Builds (link-based submissions) ──
  const seedBuilds = [
    // S4 Softcore
    { name: "Smite Hammerdin", className: "sentinel", mastery: "Paladin", seasonId: s4.id, gameMode: "softcore", playstyle: "melee", description: "Classic Paladin build using Smite and Hammer Throw for massive AoE clear. Extremely tanky with Holy Aura providing party-wide buffs. Top tier for corruption pushing.", mainSkills: '["Smite","Hammer Throw","Holy Aura","Lunge","Sigils of Hope"]', guideUrl: "https://www.lastepochtools.com/builds/hammerdin-smite", submitterId: boardman.id, up: 342, down: 18 },
    { name: "Runic Invocation Caster", className: "mage", mastery: "Runemaster", seasonId: s4.id, gameMode: "softcore", playstyle: "caster", description: "High damage caster using Runic Invocation combos. Amazing clear speed and burst. Requires good timing but rewards skilled play with insane DPS.", mainSkills: '["Runic Invocation","Flame Ward","Teleport","Frost Claw","Lightning Blast"]', guideUrl: "https://www.youtube.com/watch?v=abc123", submitterId: perry.id, up: 298, down: 22 },
    { name: "Falconer DoT", className: "rogue", mastery: "Falconer", seasonId: s4.id, gameMode: "softcore", playstyle: "ranged", description: "Devastating DoT build using Falconry and aerial attacks. Great boss killing with high mobility and solid defenses.", mainSkills: '["Falconry","Dive Bomb","Aerial Assault","Smoke Bomb","Net"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/falconer-dot", submitterId: lizard.id, up: 275, down: 15 },
    { name: "Summoner Necromancer", className: "acolyte", mastery: "Necromancer", seasonId: s4.id, gameMode: "softcore", playstyle: "summoner", description: "Army of the dead build. Summon skeletons and wraiths to obliterate everything. Very relaxed playstyle with great scaling.", mainSkills: '["Summon Skeleton","Summon Wraith","Dread Shade","Transplant","Bone Curse"]', guideUrl: "https://www.lastepochtools.com/builds/necro-summon", submitterId: mcfluffin.id, up: 256, down: 30 },
    { name: "Storm Shaman", className: "primalist", mastery: "Shaman", seasonId: s4.id, gameMode: "softcore", playstyle: "caster", description: "Totem-enhanced storm caster. Maelstrom and Gathering Storm create devastating lightning combos. Excellent AoE.", mainSkills: '["Maelstrom","Gathering Storm","Tornado","Tempest Strike","Fury Leap"]', guideUrl: "https://www.youtube.com/watch?v=storm456", submitterId: trem.id, up: 231, down: 25 },
    { name: "Void Knight Erasing Strike", className: "sentinel", mastery: "Void Knight", seasonId: s4.id, gameMode: "softcore", playstyle: "melee", description: "Void-powered melee with massive echoed hits. One of the highest single-target DPS builds in the game.", mainSkills: '["Void Cleave","Anomaly","Lunge","Devouring Orb","Rebuke"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/void-knight-erasing", submitterId: epoch.id, up: 210, down: 19 },
    { name: "Spellblade Surge", className: "mage", mastery: "Spellblade", seasonId: s4.id, gameMode: "softcore", playstyle: "hybrid", description: "Melee-caster hybrid using Surge and Enchant Weapon for explosive combos. Fast and satisfying gameplay loop.", mainSkills: '["Surge","Enchant Weapon","Flame Ward","Mana Strike","Firebrand"]', guideUrl: "https://www.lastepochtools.com/builds/spellblade-surge", submitterId: tunklab.id, up: 198, down: 32 },
    { name: "Bladedancer Shadow", className: "rogue", mastery: "Bladedancer", seasonId: s4.id, gameMode: "softcore", playstyle: "melee", description: "Lightning-fast melee assassin. Shadow Cascade and Dancing Strikes for incredible clear speed.", mainSkills: '["Shadow Cascade","Dancing Strikes","Shift","Smoke Bomb","Lethal Mirage"]', guideUrl: "https://www.youtube.com/watch?v=blade789", submitterId: trem.id, up: 188, down: 20 },
    { name: "Warlock Chaos", className: "acolyte", mastery: "Warlock", seasonId: s4.id, gameMode: "softcore", playstyle: "caster", description: "Chaos bolt spam with amazing sustain. Profane Veil makes you nearly unkillable while pumping damage.", mainSkills: '["Chaos Bolts","Profane Veil","Chthonic Fissure","Transplant","Infernal Shade"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/warlock-chaos", submitterId: cookbook.id, up: 175, down: 28 },
    { name: "Beastmaster Wolf Pack", className: "primalist", mastery: "Beastmaster", seasonId: s4.id, gameMode: "softcore", playstyle: "summoner", description: "Companion-focused build with wolves doing all the heavy lifting. You buff, they destroy.", mainSkills: '["Summon Wolf","Fury Leap","Swipe","Warcry","Summon Raptor"]', guideUrl: "https://www.lastepochtools.com/builds/beastmaster-wolves", submitterId: mcfluffin.id, up: 162, down: 22 },

    // S4 Hardcore
    { name: "Forge Guard Tank", className: "sentinel", mastery: "Forge Guard", seasonId: s4.id, gameMode: "hardcore", playstyle: "melee", description: "The ultimate HC tank. Ring of Shields + Manifest Armor for insane survivability. Slow but virtually unkillable.", mainSkills: '["Ring of Shields","Manifest Armor","Forge Strike","Rive","Vengeance"]', guideUrl: "https://www.youtube.com/watch?v=hctank1", submitterId: boardman.id, up: 189, down: 8 },
    { name: "Paladin Block HC", className: "sentinel", mastery: "Paladin", seasonId: s4.id, gameMode: "hardcore", playstyle: "melee", description: "Max block Paladin with incredible sustain. Sigils of Hope provide constant healing. Great for pushing in HC.", mainSkills: '["Smite","Sigils of Hope","Holy Aura","Lunge","Judgement"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/paladin-block-hc", submitterId: lizard.id, up: 167, down: 5 },
    { name: "Lich Death Seal HC", className: "acolyte", mastery: "Lich", seasonId: s4.id, gameMode: "hardcore", playstyle: "caster", description: "High risk, high reward Lich. Death Seal adds skill expression. Ward stacking for enormous effective HP.", mainSkills: '["Death Seal","Harvest","Aura Of Decay","Transplant","Reaper Form"]', guideUrl: "https://www.lastepochtools.com/builds/lich-death-seal-hc", submitterId: perry.id, up: 145, down: 35 },
    { name: "Druid Bear Form HC", className: "primalist", mastery: "Druid", seasonId: s4.id, gameMode: "hardcore", playstyle: "melee", description: "Werebear transformation for massive HP pool. Simple and effective for HC. Earthquake hits like a truck.", mainSkills: '["Werebear Form","Earthquake","Fury Leap","Entangling Roots","Maelstrom"]', guideUrl: "https://www.youtube.com/watch?v=druidhc2", submitterId: cookbook.id, up: 138, down: 10 },
    { name: "Marksman Safe HC", className: "rogue", mastery: "Marksman", seasonId: s4.id, gameMode: "hardcore", playstyle: "ranged", description: "Screen-wide clearing from a safe distance. Multishot and Detonating Arrow keep you far from danger.", mainSkills: '["Multishot","Detonating Arrow","Shift","Smoke Bomb","Dark Quiver"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/marksman-safe-hc", submitterId: epoch.id, up: 125, down: 12 },

    // S3 Softcore
    { name: "Sorcerer Meteor", className: "mage", mastery: "Sorcerer", seasonId: s3.id, gameMode: "softcore", playstyle: "caster", description: "Classic meteor build updated for S3. Rain fire from the sky with enormous AoE. Great for monolith farming.", mainSkills: '["Meteor","Flame Ward","Teleport","Focus","Frost Wall"]', guideUrl: "https://www.youtube.com/watch?v=meteor3", submitterId: boardman.id, up: 412, down: 25 },
    { name: "Javelin Paladin", className: "sentinel", mastery: "Paladin", seasonId: s3.id, gameMode: "softcore", playstyle: "ranged", description: "Javelin throwing Paladin with incredible range and damage. One of the best builds of S3.", mainSkills: '["Javelin","Smite","Holy Aura","Sigils of Hope","Lunge"]', guideUrl: "https://www.lastepochtools.com/builds/javelin-paladin-s3", submitterId: trem.id, up: 380, down: 20 },
    { name: "Shuriken Bladedancer", className: "rogue", mastery: "Bladedancer", seasonId: s3.id, gameMode: "softcore", playstyle: "ranged", description: "Shuriken spam with massive attack speed scaling. S3 balance changes made this top tier.", mainSkills: '["Shurikens","Shadow Cascade","Shift","Smoke Bomb","Puncture"]', guideUrl: "https://maxroll.gg/last-epoch/build-guides/shuriken-bladedancer", submitterId: lizard.id, up: 345, down: 28 },
    { name: "Skeleton Mage Army", className: "acolyte", mastery: "Necromancer", seasonId: s3.id, gameMode: "softcore", playstyle: "summoner", description: "Skeleton mage variant focusing on ranged minions. Sit back and watch them destroy everything.", mainSkills: '["Summon Skeleton","Bone Curse","Dread Shade","Transplant","Spirit Plague"]', guideUrl: "https://www.lastepochtools.com/builds/skeleton-mage-army", submitterId: mcfluffin.id, up: 310, down: 18 },
    { name: "Druid Spriggan Caster", className: "primalist", mastery: "Druid", seasonId: s3.id, gameMode: "softcore", playstyle: "caster", description: "Spriggan Form caster with nature spells. Unique and fun playstyle with solid damage.", mainSkills: '["Spriggan Form","Summon Spriggan","Entangling Roots","Maelstrom","Fury Leap"]', guideUrl: "https://www.youtube.com/watch?v=spriggan3", submitterId: tunklab.id, up: 265, down: 30 },
  ];

  for (const b of seedBuilds) {
    const { up, down, ...buildData } = b;
    const created = storage.createBuild(buildData as any);
    db.run(sql`UPDATE builds SET upvotes = ${up}, downvotes = ${down} WHERE id = ${created.id}`);
  }
}

// ─── Routes ────────────────────────────────────────────────────

export async function registerRoutes(server: Server, app: Express) {
  initDB();

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
    const { passwordHash, ...safe } = user;
    res.status(201).json(safe);
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = storage.getUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const { passwordHash, ...safe } = user;
    res.json(safe);
  });

  app.get("/api/users/:id", (req, res) => {
    const user = storage.getUserById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safe } = user;
    const builds = storage.getUserBuilds(user.id);
    res.json({ ...safe, builds });
  });

  app.get("/api/users/top/leaderboard", (req, res) => {
    const topUsers = storage.getTopUsers(20);
    res.json(topUsers.map(({ passwordHash, ...u }) => u));
  });

  // ── Seasons ──

  app.get("/api/seasons", (_req, res) => {
    res.json(storage.getSeasons());
  });

  app.post("/api/seasons", (req, res) => {
    const { adminUserId, ...seasonData } = req.body;
    const admin = storage.getUserById(adminUserId);
    if (!admin?.isAdmin) return res.status(403).json({ error: "Admin only" });

    const parsed = insertSeasonSchema.safeParse(seasonData);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const season = storage.createSeason(parsed.data);
    res.status(201).json(season);
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

  app.get("/api/builds", (req, res) => {
    const { seasonId, gameMode, className, mastery } = req.query;
    res.json(storage.getBuilds({
      seasonId: seasonId ? parseInt(seasonId as string) : undefined,
      gameMode: gameMode as string | undefined,
      className: className as string | undefined,
      mastery: mastery as string | undefined,
    }));
  });

  app.get("/api/builds/:id", (req, res) => {
    const build = storage.getBuild(parseInt(req.params.id));
    if (!build) return res.status(404).json({ error: "Build not found" });
    res.json(build);
  });

  app.post("/api/builds", (req, res) => {
    const parsed = insertBuildSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

    // Verify submitter exists
    const user = storage.getUserById(parsed.data.submitterId);
    if (!user) return res.status(400).json({ error: "Invalid submitter" });

    // Verify season exists
    const season = storage.getSeason(parsed.data.seasonId);
    if (!season) return res.status(400).json({ error: "Invalid season" });

    const build = storage.createBuild(parsed.data);
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

    // Toggle: if same vote type exists, remove it
    const existing = storage.getVote(buildId, userId);
    if (existing && existing.voteType === voteType) {
      storage.removeVote(buildId, userId);
      const updated = storage.getBuild(buildId);
      return res.json({ build: updated, action: "removed" });
    }

    storage.castVote(buildId, userId, voteType);
    const updated = storage.getBuild(buildId);
    res.json({ build: updated, action: "voted" });
  });

  app.get("/api/votes/user/:userId", (req, res) => {
    res.json(storage.getUserVotes(parseInt(req.params.userId)));
  });

  // ── Tier List ──

  app.get("/api/tier-list", (req, res) => {
    const { seasonId, gameMode } = req.query;
    const allBuilds = storage.getBuilds({
      seasonId: seasonId ? parseInt(seasonId as string) : undefined,
      gameMode: gameMode as string | undefined,
    });

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
    res.json(tierList);
  });

  // ── Source detection helper ──

  app.post("/api/detect-source", (req, res) => {
    const { url } = req.body;
    res.json({ source: detectSource(url || "") });
  });
}
