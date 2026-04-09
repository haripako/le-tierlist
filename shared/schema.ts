import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Game categories ───────────────────────────────────────────
export const GAME_CATEGORIES = ["arpg", "looter-shooter", "mmo", "other"] as const;
export type GameCategory = (typeof GAME_CATEGORIES)[number];

// ─── Categories table (editable) ──────────────────────────────
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull().default("🎮"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// ─── Games table ──────────────────────────────────────────────
export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#d4a537"),
  icon: text("icon").notNull().default("⚔️"),
  category: text("category").notNull().default("arpg"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  hasSeasons: integer("has_seasons", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  lastFeaturedAt: text("last_featured_at"),
  createdAt: text("created_at").notNull(),
});

// ─── Game modes table ──────────────────────────────────────────
export const gameModes = sqliteTable("game_modes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
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
  bio: text("bio"),
  avatarEmoji: text("avatar_emoji").default("🎮"),
  createdAt: text("created_at").notNull(),
});

// ─── Builds table ─────────────────────────────────────────────
export const builds = sqliteTable("builds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id").notNull(),
  gameClassId: integer("game_class_id"), // nullable FK → game_classes.id
  seasonId: integer("season_id"),        // nullable FK → seasons.id
  gameModeId: integer("game_mode_id"),   // nullable FK → game_modes.id
  name: text("name").notNull(),
  className: text("class_name").notNull(),
  mastery: text("mastery").notNull().default(""),
  playstyle: text("playstyle").notNull(),
  description: text("description").notNull().default(""),
  mainSkills: text("main_skills").notNull().default("[]"),
  guideUrl: text("guide_url").notNull(),
  sourceType: text("source_type").notNull().default("other"),
  submitterId: integer("submitter_id"),  // nullable — anon support
  anonHash: text("anon_hash"),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  views: integer("views").notNull().default(0),
  socialScore: integer("social_score").notNull().default(0),
  socialViews: integer("social_views").notNull().default(0),
  socialShares: integer("social_shares").notNull().default(0),
  isTrending: integer("is_trending", { mode: "boolean" }).notNull().default(false),
  isViral: integer("is_viral", { mode: "boolean" }).notNull().default(false),
  trendingReason: text("trending_reason"),
  pros: text("pros"),          // JSON array of strings
  cons: text("cons"),          // JSON array of strings
  engagementText: text("engagement_text"),
  difficulty: text("difficulty"), // beginner | intermediate | advanced | expert
  budgetLevel: text("budget_level"), // budget | mid-range | expensive | endgame
  thumbnailUrl: text("thumbnail_url"),  // extracted og:image or YouTube thumbnail
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

// ─── Bookmarks ────────────────────────────────────────────────
export const bookmarks = sqliteTable("bookmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  buildId: integer("build_id").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Anonymous bookmarks ──────────────────────────────────────
export const anonBookmarks = sqliteTable("anon_bookmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buildId: integer("build_id").notNull(),
  voterHash: text("voter_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

// ─── Reports ──────────────────────────────────────────────────
export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buildId: integer("build_id").notNull(),
  voterHash: text("voter_hash").notNull(),
  reason: text("reason").notNull().default("inappropriate"),
  createdAt: text("created_at").notNull(),
});

// ─── Insert schemas ────────────────────────────────────────────

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true, createdAt: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true, createdAt: true,
});

export const insertGameModeSchema = createInsertSchema(gameModes).omit({
  id: true,
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
  views: true, socialScore: true, socialViews: true, socialShares: true,
  isTrending: true, isViral: true, trendingReason: true,
}).extend({
  description: z.string().default(""),
  mainSkills: z.string().default("[]"),
  submitterId: z.number().nullable().default(null),
  gameClassId: z.number().nullable().default(null),
  seasonId: z.number().nullable().default(null),
  gameModeId: z.number().nullable().default(null),
  mastery: z.string().default(""),
  anonHash: z.string().nullable().default(null),
  pros: z.string().nullable().default(null),
  cons: z.string().nullable().default(null),
  engagementText: z.string().nullable().default(null),
  difficulty: z.string().nullable().default(null),
  budgetLevel: z.string().nullable().default(null),
  thumbnailUrl: z.string().nullable().default(null),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true, createdAt: true,
});

// ─── Types ────────────────────────────────────────────────────

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type GameMode = typeof gameModes.$inferSelect;
export type InsertGameMode = z.infer<typeof insertGameModeSchema>;
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
export type Bookmark = typeof bookmarks.$inferSelect;
export type AnonBookmark = typeof anonBookmarks.$inferSelect;
export type Report = typeof reports.$inferSelect;

// Extended response types
export type BuildWithSubmitter = Build & {
  submitterName: string;
  submitterKarma: number;
  submitterAvatar: string;
  seasonSlug: string | null;
  seasonName: string | null;
  gameModeName: string | null;
  gameModeSlug: string | null;
  gameName: string;
  gameSlug: string;
  gameIcon: string;
  gameColor: string;
  bookmarkCount: number;
};

export type GameWithMeta = Game & {
  buildCount: number;
  classes: GameClass[];
  activeSeasons: Season[];
  modes: GameMode[];
};

// ─── Social posts table ──────────────────────────────────────
export const socialPosts = sqliteTable("social_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buildId: integer("build_id").notNull(),
  gameId: integer("game_id").notNull(),
  platform: text("platform").notNull(), // twitter | instagram | tiktok | youtube_shorts
  content: text("content").notNull(),
  hashtags: text("hashtags").notNull(), // comma-separated
  hookLine: text("hook_line").notNull(),
  tierLabel: text("tier_label"), // S-tier, A-tier, etc.
  status: text("status").notNull().default("pending"), // pending | approved | posted | dismissed
  createdAt: text("created_at").notNull(),
});

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;

// ─── Static source config ─────────────────────────────────────
export const BUILD_SOURCES = [
  { id: "lastepochtools", name: "Last Epoch Tools", domain: "lastepochtools.com", icon: "🔧" },
  { id: "maxroll", name: "Maxroll", domain: "maxroll.gg", icon: "📊" },
  { id: "youtube", name: "YouTube", domain: "youtube.com", icon: "▶️" },
  { id: "youtube_short", name: "YouTube", domain: "youtu.be", icon: "▶️" },
  { id: "mobalytics", name: "Mobalytics", domain: "mobalytics.gg", icon: "📈" },
  { id: "reddit", name: "Reddit", domain: "reddit.com", icon: "💬" },
  { id: "icy-veins", name: "Icy Veins", domain: "icy-veins.com", icon: "❄️" },
  { id: "fextralife", name: "Fextralife", domain: "fextralife.com", icon: "📖" },
  { id: "game8", name: "Game8", domain: "game8.co", icon: "🎮" },
  { id: "poe-ninja", name: "PoE Ninja", domain: "poe.ninja", icon: "🥷" },
  { id: "poebuilds", name: "PoE Builds", domain: "poebuilds.net", icon: "🔥" },
  { id: "poewiki", name: "PoE Wiki", domain: "poewiki.net", icon: "📚" },
  { id: "builds-gg", name: "Builds.gg", domain: "builds.gg", icon: "🏗️" },
  { id: "hacktheminotaur", name: "HackTheMinotaur", domain: "hacktheminotaur.com", icon: "🐂" },
  { id: "other", name: "Other", domain: "", icon: "🔗" },
] as const;
