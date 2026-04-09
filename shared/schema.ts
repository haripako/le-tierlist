import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Last Epoch classes and their masteries
export const CLASSES = [
  { id: "sentinel", name: "Sentinel", masteries: ["Void Knight", "Forge Guard", "Paladin"] },
  { id: "mage", name: "Mage", masteries: ["Sorcerer", "Spellblade", "Runemaster"] },
  { id: "primalist", name: "Primalist", masteries: ["Beastmaster", "Shaman", "Druid"] },
  { id: "rogue", name: "Rogue", masteries: ["Bladedancer", "Marksman", "Falconer"] },
  { id: "acolyte", name: "Acolyte", masteries: ["Necromancer", "Lich", "Warlock"] },
] as const;

export const ALL_MASTERIES = CLASSES.flatMap(c => c.masteries);

export const SEASONS = [
  { id: "s4", name: "Season 4 - Shattered Omens", patch: "1.4" },
  { id: "s3", name: "Season 3 - Beneath Ancient Skies", patch: "1.3" },
  { id: "s2", name: "Season 2 - Tombs of the Erased", patch: "1.2" },
  { id: "s1", name: "Season 1 - Harbingers of Ruin", patch: "1.1" },
  { id: "release", name: "Release (1.0)", patch: "1.0" },
] as const;

export const GAME_MODES = ["softcore", "hardcore"] as const;

export const PLAYSTYLES = ["melee", "ranged", "caster", "summoner", "hybrid"] as const;

// Builds table
export const builds = sqliteTable("builds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  className: text("class_name").notNull(),
  mastery: text("mastery").notNull(),
  seasonId: text("season_id").notNull(),
  gameMode: text("game_mode").notNull(), // softcore | hardcore
  playstyle: text("playstyle").notNull(),
  description: text("description").notNull(),
  mainSkills: text("main_skills").notNull(), // JSON array of skill names
  guideUrl: text("guide_url"), // optional link to build guide
  author: text("author").notNull(),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// Votes table - track votes by session/fingerprint
export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buildId: integer("build_id").notNull(),
  voterId: text("voter_id").notNull(), // session or fingerprint
  voteType: text("vote_type").notNull(), // "up" | "down"
  createdAt: text("created_at").notNull(),
});

// Insert schemas
export const insertBuildSchema = createInsertSchema(builds).omit({
  id: true,
  upvotes: true,
  downvotes: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

// Types
export type Build = typeof builds.$inferSelect;
export type InsertBuild = z.infer<typeof insertBuildSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
