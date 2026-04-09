import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertBuildSchema } from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Create tables
function initDB() {
  db.run(sql`CREATE TABLE IF NOT EXISTS builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    mastery TEXT NOT NULL,
    season_id TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    playstyle TEXT NOT NULL,
    description TEXT NOT NULL,
    main_skills TEXT NOT NULL,
    guide_url TEXT,
    author TEXT NOT NULL,
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    build_id INTEGER NOT NULL,
    voter_id TEXT NOT NULL,
    vote_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  // Seed data if empty
  const count = db.run(sql`SELECT count(*) as c FROM builds`);
  const row = db.all(sql`SELECT count(*) as c FROM builds`);
  // @ts-ignore
  if (row[0]?.c === 0) {
    seedBuilds();
  }
}

function seedBuilds() {
  const seedData = [
    // Season 4 Softcore builds
    { name: "Smite Hammerdin", className: "sentinel", mastery: "Paladin", seasonId: "s4", gameMode: "softcore", playstyle: "melee", description: "Classic Paladin build using Smite and Hammer Throw for massive AoE clear. Extremely tanky with Holy Aura providing party-wide buffs. Top tier for corruption pushing.", mainSkills: JSON.stringify(["Smite", "Hammer Throw", "Holy Aura", "Lunge", "Sigils of Hope"]), author: "Boardman21", upvotes: 342, downvotes: 18 },
    { name: "Runic Invocation Caster", className: "mage", mastery: "Runemaster", seasonId: "s4", gameMode: "softcore", playstyle: "caster", description: "High damage caster using Runic Invocation combos. Amazing clear speed and burst. Requires good timing but rewards skilled play with insane DPS.", mainSkills: JSON.stringify(["Runic Invocation", "Flame Ward", "Teleport", "Frost Claw", "Lightning Blast"]), author: "Perrythepig", upvotes: 298, downvotes: 22 },
    { name: "Falconer DoT", className: "rogue", mastery: "Falconer", seasonId: "s4", gameMode: "softcore", playstyle: "ranged", description: "Devastating DoT build using Falconry and aerial attacks. Great boss killing with high mobility and solid defenses.", mainSkills: JSON.stringify(["Falconry", "Dive Bomb", "Aerial Assault", "Smoke Bomb", "Net"]), author: "LizardIRL", upvotes: 275, downvotes: 15 },
    { name: "Summoner Necromancer", className: "acolyte", mastery: "Necromancer", seasonId: "s4", gameMode: "softcore", playstyle: "summoner", description: "Army of the dead build. Summon skeletons and wraiths to obliterate everything. Very relaxed playstyle with great scaling.", mainSkills: JSON.stringify(["Summon Skeleton", "Summon Wraith", "Dread Shade", "Transplant", "Bone Curse"]), author: "McFluffin", upvotes: 256, downvotes: 30 },
    { name: "Storm Shaman", className: "primalist", mastery: "Shaman", seasonId: "s4", gameMode: "softcore", playstyle: "caster", description: "Totem-enhanced storm caster. Maelstrom and Gathering Storm create devastating lightning combos. Excellent AoE.", mainSkills: JSON.stringify(["Maelstrom", "Gathering Storm", "Tornado", "Tempest Strike", "Fury Leap"]), author: "Trem", upvotes: 231, downvotes: 25 },
    { name: "Void Knight Erasing Strike", className: "sentinel", mastery: "Void Knight", seasonId: "s4", gameMode: "softcore", playstyle: "melee", description: "Void-powered melee with massive echoed hits. One of the highest single-target DPS builds in the game.", mainSkills: JSON.stringify(["Void Cleave", "Anomaly", "Lunge", "Devouring Orb", "Rebuke"]), author: "Epoch_Builds", upvotes: 210, downvotes: 19 },
    { name: "Spellblade Surge", className: "mage", mastery: "Spellblade", seasonId: "s4", gameMode: "softcore", playstyle: "hybrid", description: "Melee-caster hybrid using Surge and Enchant Weapon for explosive combos. Fast and satisfying gameplay.", mainSkills: JSON.stringify(["Surge", "Enchant Weapon", "Flame Ward", "Mana Strike", "Firebrand"]), author: "Tunklab", upvotes: 198, downvotes: 32 },
    { name: "Bladedancer Shadow", className: "rogue", mastery: "Bladedancer", seasonId: "s4", gameMode: "softcore", playstyle: "melee", description: "Lightning-fast melee assassin. Shadow Cascade and Dancing Strikes for incredible clear speed.", mainSkills: JSON.stringify(["Shadow Cascade", "Dancing Strikes", "Shift", "Smoke Bomb", "Lethal Mirage"]), author: "Trem", upvotes: 188, downvotes: 20 },
    { name: "Warlock Chaos", className: "acolyte", mastery: "Warlock", seasonId: "s4", gameMode: "softcore", playstyle: "caster", description: "Chaos bolt spam with amazing sustain. Profane Veil makes you nearly unkillable while pumping damage.", mainSkills: JSON.stringify(["Chaos Bolts", "Profane Veil", "Chthonic Fissure", "Transplant", "Infernal Shade"]), author: "CookBook", upvotes: 175, downvotes: 28 },
    { name: "Beastmaster Wolf Pack", className: "primalist", mastery: "Beastmaster", seasonId: "s4", gameMode: "softcore", playstyle: "summoner", description: "Companion-focused build with wolves doing all the heavy lifting. You buff, they destroy.", mainSkills: JSON.stringify(["Summon Wolf", "Fury Leap", "Swipe", "Warcry", "Summon Raptor"]), author: "McFluffin", upvotes: 162, downvotes: 22 },
    
    // Season 4 Hardcore builds
    { name: "Forge Guard Tank", className: "sentinel", mastery: "Forge Guard", seasonId: "s4", gameMode: "hardcore", playstyle: "melee", description: "The ultimate HC tank. Ring of Shields + Manifest Armor for insane survivability. Slow but virtually unkillable.", mainSkills: JSON.stringify(["Ring of Shields", "Manifest Armor", "Forge Strike", "Rive", "Vengeance"]), author: "Boardman21", upvotes: 189, downvotes: 8 },
    { name: "Paladin Block HC", className: "sentinel", mastery: "Paladin", seasonId: "s4", gameMode: "hardcore", playstyle: "melee", description: "Max block Paladin with incredible sustain. Sigils of Hope provide constant healing. Great for pushing in HC.", mainSkills: JSON.stringify(["Smite", "Sigils of Hope", "Holy Aura", "Lunge", "Judgement"]), author: "LizardIRL", upvotes: 167, downvotes: 5 },
    { name: "Lich Death Seal HC", className: "acolyte", mastery: "Lich", seasonId: "s4", gameMode: "hardcore", playstyle: "caster", description: "High risk, high reward Lich. Death Seal mechanic adds skill expression. Ward stacking for enormous effective HP.", mainSkills: JSON.stringify(["Death Seal", "Harvest", "Aura Of Decay", "Transplant", "Reaper Form"]), author: "Perrythepig", upvotes: 145, downvotes: 35 },
    { name: "Druid Bear Form HC", className: "primalist", mastery: "Druid", seasonId: "s4", gameMode: "hardcore", playstyle: "melee", description: "Werebear transformation for massive HP pool. Simple and effective for HC. Earthquake hits like a truck.", mainSkills: JSON.stringify(["Werebear Form", "Earthquake", "Fury Leap", "Entangling Roots", "Maelstrom"]), author: "CookBook", upvotes: 138, downvotes: 10 },
    { name: "Marksman Safe HC", className: "rogue", mastery: "Marksman", seasonId: "s4", gameMode: "hardcore", playstyle: "ranged", description: "Screen-wide clearing from a safe distance. Multishot and Detonating Arrow keep you far from danger.", mainSkills: JSON.stringify(["Multishot", "Detonating Arrow", "Shift", "Smoke Bomb", "Dark Quiver"]), author: "Epoch_Builds", upvotes: 125, downvotes: 12 },

    // Season 3 builds
    { name: "Sorcerer Meteor", className: "mage", mastery: "Sorcerer", seasonId: "s3", gameMode: "softcore", playstyle: "caster", description: "Classic meteor build updated for S3. Rain fire from the sky with enormous AoE damage. Great for monolith farming.", mainSkills: JSON.stringify(["Meteor", "Flame Ward", "Teleport", "Focus", "Frost Wall"]), author: "Boardman21", upvotes: 412, downvotes: 25 },
    { name: "Javelin Paladin", className: "sentinel", mastery: "Paladin", seasonId: "s3", gameMode: "softcore", playstyle: "ranged", description: "Javelin throwing Paladin with incredible range and damage. One of the best builds of S3.", mainSkills: JSON.stringify(["Javelin", "Smite", "Holy Aura", "Sigils of Hope", "Lunge"]), author: "Trem", upvotes: 380, downvotes: 20 },
    { name: "Shuriken Bladedancer", className: "rogue", mastery: "Bladedancer", seasonId: "s3", gameMode: "softcore", playstyle: "ranged", description: "Shuriken spam with massive attack speed scaling. S3 balance changes made this top tier.", mainSkills: JSON.stringify(["Shurikens", "Shadow Cascade", "Shift", "Smoke Bomb", "Puncture"]), author: "LizardIRL", upvotes: 345, downvotes: 28 },
    { name: "Skeleton Mage Army", className: "acolyte", mastery: "Necromancer", seasonId: "s3", gameMode: "softcore", playstyle: "summoner", description: "Skeleton mage variant focusing on ranged minions. Sit back and watch them destroy everything.", mainSkills: JSON.stringify(["Summon Skeleton", "Bone Curse", "Dread Shade", "Transplant", "Spirit Plague"]), author: "McFluffin", upvotes: 310, downvotes: 18 },
    { name: "Druid Spriggan Caster", className: "primalist", mastery: "Druid", seasonId: "s3", gameMode: "softcore", playstyle: "caster", description: "Spriggan Form caster with nature spells. Unique and fun playstyle with solid damage.", mainSkills: JSON.stringify(["Spriggan Form", "Summon Spriggan", "Entangling Roots", "Maelstrom", "Fury Leap"]), author: "Tunklab", upvotes: 265, downvotes: 30 },
  ];

  for (const build of seedData) {
    storage.createBuild(build as any);
    // Manually set upvotes/downvotes for seed data
    const created = db.all(sql`SELECT id FROM builds ORDER BY id DESC LIMIT 1`);
    // @ts-ignore
    const id = created[0]?.id;
    if (id) {
      db.run(sql`UPDATE builds SET upvotes = ${build.upvotes}, downvotes = ${build.downvotes} WHERE id = ${id}`);
    }
  }
}

export async function registerRoutes(server: Server, app: Express) {
  initDB();

  // GET /api/builds - list builds with optional filters
  app.get("/api/builds", (req, res) => {
    const { seasonId, gameMode, className, mastery } = req.query;
    const builds = storage.getBuilds({
      seasonId: seasonId as string | undefined,
      gameMode: gameMode as string | undefined,
      className: className as string | undefined,
      mastery: mastery as string | undefined,
    });
    res.json(builds);
  });

  // GET /api/builds/:id - single build
  app.get("/api/builds/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const build = storage.getBuild(id);
    if (!build) return res.status(404).json({ error: "Build not found" });
    res.json(build);
  });

  // POST /api/builds - create build
  app.post("/api/builds", (req, res) => {
    const parsed = insertBuildSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
    const build = storage.createBuild(parsed.data);
    res.status(201).json(build);
  });

  // POST /api/builds/:id/vote - vote on a build
  app.post("/api/builds/:id/vote", (req, res) => {
    const buildId = parseInt(req.params.id);
    const { voterId, voteType } = req.body;
    
    if (!voterId || !["up", "down"].includes(voteType)) {
      return res.status(400).json({ error: "Invalid vote" });
    }

    const build = storage.getBuild(buildId);
    if (!build) return res.status(404).json({ error: "Build not found" });

    // Check if same vote exists - if so, remove it (toggle off)
    const existing = storage.getVote(buildId, voterId);
    if (existing && existing.voteType === voteType) {
      storage.removeVote(buildId, voterId);
      const updated = storage.getBuild(buildId);
      return res.json({ build: updated, action: "removed" });
    }

    const vote = storage.castVote({ buildId, voterId, voteType });
    const updated = storage.getBuild(buildId);
    res.json({ build: updated, action: "voted" });
  });

  // GET /api/votes/:voterId - get all votes by a voter
  app.get("/api/votes/:voterId", (req, res) => {
    const votes = storage.getVoterVotes(req.params.voterId);
    res.json(votes);
  });

  // GET /api/tier-list - computed tier list
  app.get("/api/tier-list", (req, res) => {
    const { seasonId, gameMode } = req.query;
    const allBuilds = storage.getBuilds({
      seasonId: seasonId as string | undefined,
      gameMode: gameMode as string | undefined,
    });

    // Calculate score and assign tiers
    const scored = allBuilds.map(b => ({
      ...b,
      score: b.upvotes - b.downvotes,
      ratio: b.upvotes + b.downvotes > 0 
        ? b.upvotes / (b.upvotes + b.downvotes)
        : 0.5,
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Assign tiers based on percentile
    const total = scored.length;
    const tiered = scored.map((build, i) => {
      const percentile = total > 0 ? (i / total) : 1;
      let tier: string;
      if (percentile < 0.1) tier = "S";
      else if (percentile < 0.25) tier = "A";
      else if (percentile < 0.50) tier = "B";
      else if (percentile < 0.75) tier = "C";
      else tier = "D";
      return { ...build, tier };
    });

    // Group by tier
    const tierList: Record<string, typeof tiered> = { S: [], A: [], B: [], C: [], D: [] };
    for (const build of tiered) {
      tierList[build.tier].push(build);
    }

    res.json(tierList);
  });
}
