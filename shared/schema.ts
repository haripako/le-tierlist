import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Static data ───────────────────────────────────────────────

export const CLASSES = [
  { id: "sentinel", name: "Sentinel", masteries: ["Void Knight", "Forge Guard", "Paladin"] },
  { id: "mage", name: "Mage", masteries: ["Sorcerer", "Spellblade", "Runemaster"] },
  { id: "primalist", name: "Primalist", masteries: ["Beastmaster", "Shaman", "Druid"] },
  { id: "rogue", name: "Rogue", masteries: ["Bladedancer", "Marksman", "Falconer"] },
  { id: "acolyte", name: "Acolyte", masteries: ["Necromancer", "Lich", "Warlock"] },
] as const;

export const ALL_MASTERIES = CLASSES.flatMap(c => c.masteries);
export const GAME_MODES = ["softcore", "hardcore"] as const;
export const PLAYSTYLES = ["melee", "ranged", "caster", "summoner", "hybrid"] as const;

// Known build guide sources
export const BUILD_SOURCES = [
  { id: "lastepochtools", name: "Last Epoch Tools", domain: "lastepochtools.com", icon: "🔧" },
  { id: "maxroll", name: "Maxroll", domain: "maxroll.gg", icon: "📊" },
  { id: "youtube", name: "YouTube", domain: "youtube.com", icon: "▶️" },
  { id: "youtube_short", name: "YouTube", domain: "youtu.be", icon: "▶️" },
  { id: "mobalytics", name: "Mobalytics", domain: "mobalytics.gg", icon: "📈" },
  { id: "reddit", name: "Reddit", domain: "reddit.com", icon: "💬" },
  { id: "other", name: "Other", domain: "", icon: "🔗" },
] as const;

// ─── Database tables ───────────────────────────────────────────

// Users with Reddit-style karma
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  karma: integer("karma").notNull().default(0),
  buildSubmissions: integer("build_submissions").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// Admin-managed seasons
export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(), // "s4", "s3", etc.
  name: text("name").notNull(), // "Season 4 - Shattered Omens"
  patch: text("patch").notNull(), // "1.4"
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// Builds — now link-based submissions
export const builds = sqliteTable("builds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  className: text("class_name").notNull(),
  mastery: text("mastery").notNull(),
  seasonId: integer("season_id").notNull(), // FK → seasons.id
  gameMode: text("game_mode").notNull(),
  playstyle: text("playstyle").notNull(),
  description: text("description").notNull(),
  mainSkills: text("main_skills").notNull(), // JSON array
  guideUrl: text("guide_url").notNull(), // REQUIRED — the linked build guide
  sourceType: text("source_type").notNull(), // auto-detected from URL
  submitterId: integer("submitter_id").notNull(), // FK → users.id
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// Votes on builds
export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buildId: integer("build_id").notNull(),
  userId: integer("user_id").notNull(),
  voteType: text("vote_type").notNull(), // "up" | "down"
  createdAt: text("created_at").notNull(),
});

// ─── Insert schemas ────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, karma: true, buildSubmissions: true, createdAt: true, isAdmin: true,
});

export const insertSeasonSchema = createInsertSchema(seasons).omit({
  id: true, createdAt: true,
});

export const insertBuildSchema = createInsertSchema(builds).omit({
  id: true, upvotes: true, downvotes: true, createdAt: true, sourceType: true,
}).extend({
  description: z.string().default(""),
  mainSkills: z.string().default("[]"),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true, createdAt: true,
});

// ─── Types ─────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Season = typeof seasons.$inferSelect;
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Build = typeof builds.$inferSelect;
export type InsertBuild = z.infer<typeof insertBuildSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

// Build with joined data for API responses
export type BuildWithSubmitter = Build & {
  submitterName: string;
  submitterKarma: number;
  seasonSlug: string;
  seasonName: string;
};
