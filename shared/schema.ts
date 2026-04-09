import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Game categories ───────────────────────────────────────────
export const GAME_CATEGORIES = ["arpg", "looter-shooter", "mmo", "other"] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

// ─── Games table ──────────────────────────────────────────────
export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#d4a537"),
  icon: text("icon").notNull().default("⚔️"),
  category: text("category").notNull().default("arpg"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// ─── Game classes table ────────────────────────────────────────
export const gameClasses = sqliteTable("game_classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull(),
  name: text("name").notNull(),
  masteries: text("masteries").notNull().default("[]"), // JSON array
  color: text("color").notNull().default("#888888"),
});

// ─── Seasons table (updated — has gameId) ─────────────────────
export const seasons = sqliteTable("seasons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  patch: text("patch").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// ─── Users ────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  karma: integer("karma").notNull().default(0),
  buildSubmissions: integer("build_submissions").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// ─── Builds table (updated — multi-game) ──────────────────────
export const builds = sqliteTable("builds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull(),
  gameClassId: integer("game_class_id"), // nullable FK → game_classes.id
  seasonId: integer("season_id"),        // nullable FK → seasons.id
  name: text("name").notNull(),
  className: text("class_name").notNull(),
  mastery: text("mastery").notNull().default(""),
  gameMode: text("game_mode").notNull().default("softcore"),
  playstyle: text("playstyle").notNull(),
  description: text("description").notNull().default(""),
  mainSkills: text("main_skills").notNull().default("[]"),
  guideUrl: text("guide_url").notNull(),
  sourceType: text("source_type").notNull().default("other"),
  submitterId: integer("submitter_id"),  // nullable — anon support
  anonHash: text("anon_hash"),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// ─── Votes ────────────────────────────────────────────────────
export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buildId: integer("build_id").notNull(),
  userId: integer("user_id").notNull(),
  voteType: text("vote_type").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Anonymous votes ──────────────────────────────────────────
export const anonVotes = sqliteTable("anon_votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buildId: integer("build_id").notNull(),
  voterHash: text("voter_hash").notNull(),
  voteType: text("vote_type").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Insert schemas ────────────────────────────────────────────

export const insertGameSchema = createInsertSchema(games).omit({
  id: true, createdAt: true,
});

export const insertGameClassSchema = createInsertSchema(gameClasses).omit({
  id: true,
}).extend({
  masteries: z.string().default("[]"),
});

export const insertSeasonSchema = createInsertSchema(seasons).omit({
  id: true, createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, karma: true, buildSubmissions: true, createdAt: true, isAdmin: true,
});

export const insertBuildSchema = createInsertSchema(builds).omit({
  id: true, upvotes: true, downvotes: true, createdAt: true, sourceType: true,
}).extend({
  description: z.string().default(""),
  mainSkills: z.string().default("[]"),
  submitterId: z.number().nullable().default(null),
  gameClassId: z.number().nullable().default(null),
  seasonId: z.number().nullable().default(null),
  mastery: z.string().default(""),
  anonHash: z.string().nullable().default(null),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true, createdAt: true,
});

// ─── Types ────────────────────────────────────────────────────

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type GameClass = typeof gameClasses.$inferSelect;
export type InsertGameClass = z.infer<typeof insertGameClassSchema>;
export type Season = typeof seasons.$inferSelect;
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Build = typeof builds.$inferSelect;
export type InsertBuild = z.infer<typeof insertBuildSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

// Extended response types
export type BuildWithSubmitter = Build & {
  submitterName: string;
  submitterKarma: number;
  seasonSlug: string | null;
  seasonName: string | null;
  gameName: string;
  gameSlug: string;
  gameIcon: string;
  gameColor: string;
};

export type GameWithMeta = Game & {
  buildCount: number;
  classes: GameClass[];
  activeSeasons: Season[];
};

// ─── Static source config ─────────────────────────────────────
export const BUILD_SOURCES = [
  { id: "lastepochtools", name: "Last Epoch Tools", domain: "lastepochtools.com", icon: "🔧" },
  { id: "maxroll", name: "Maxroll", domain: "maxroll.gg", icon: "📊" },
  { id: "youtube", name: "YouTube", domain: "youtube.com", icon: "▶️" },
  { id: "youtube_short", name: "YouTube", domain: "youtu.be", icon: "▶️" },
  { id: "mobalytics", name: "Mobalytics", domain: "mobalytics.gg", icon: "📈" },
  { id: "reddit", name: "Reddit", domain: "reddit.com", icon: "💬" },
  { id: "other", name: "Other", domain: "", icon: "🔗" },
] as const;
