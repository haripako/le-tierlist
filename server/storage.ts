import {
  games, gameModes, gameClasses, seasons, users, builds, votes, anonVotes, tierVotes, anonTierVotes, socialPosts,
  bookmarks, anonBookmarks, reports, categories,
  type Game, type InsertGame,
  type GameMode, type InsertGameMode,
  type GameClass, type InsertGameClass,
  type Season, type InsertSeason,
  type User, type InsertUser,
  type Build, type InsertBuild,
  type Vote, type InsertVote,
  type TierVote, type AnonTierVote,
  type SocialPost, type InsertSocialPost,
  type BuildWithSubmitter,
  type Category, type InsertCategory,
  type Bookmark, type AnonBookmark, type Report,
  BUILD_SOURCES,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

// ─── Helpers ───────────────────────────────────────────────────

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function detectSource(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const found = BUILD_SOURCES.find(s => s.domain && hostname.includes(s.domain));
    return found?.id ?? "other";
  } catch {
    return "other";
  }
}

// ─── Storage interface ─────────────────────────────────────────

export interface IStorage {
  // Categories
  getCategories(): Category[];
  getCategory(id: number): Category | undefined;
  getCategoryBySlug(slug: string): Category | undefined;
  createCategory(cat: InsertCategory): Category;
  updateCategory(id: number, data: Partial<InsertCategory>): Category | undefined;
  deleteCategory(id: number): void;

  // Games
  getGames(): Game[];
  getGame(id: number): Game | undefined;
  getGameBySlug(slug: string): Game | undefined;
  createGame(game: InsertGame): Game;
  updateGame(id: number, data: Partial<InsertGame>): Game | undefined;
  deleteGame(id: number): void;

  // Game modes
  getGameModes(gameId: number): GameMode[];
  getGameMode(id: number): GameMode | undefined;
  getDefaultGameMode(gameId: number): GameMode | undefined;
  createGameMode(mode: InsertGameMode): GameMode;
  updateGameMode(id: number, data: Partial<InsertGameMode>): GameMode | undefined;
  deleteGameMode(id: number): void;

  // Game classes
  getGameClasses(gameId: number): GameClass[];
  getGameClass(id: number): GameClass | undefined;
  createGameClass(cls: InsertGameClass): GameClass;
  updateGameClass(id: number, data: Partial<InsertGameClass>): GameClass | undefined;
  deleteGameClass(id: number): void;

  // Seasons
  getSeasons(): Season[];
  getSeasonsByGame(gameId: number): Season[];
  getActiveSeason(gameId?: number): Season | undefined;
  getSeason(id: number): Season | undefined;
  getSeasonBySlug(slug: string): Season | undefined;
  createSeason(season: InsertSeason): Season;
  updateSeason(id: number, data: Partial<InsertSeason>): Season | undefined;
  deleteSeason(id: number): void;

  // Users
  createUser(user: InsertUser): User;
  getUserByUsername(username: string): User | undefined;
  getUserById(id: number): User | undefined;
  updateKarma(userId: number, delta: number): void;
  updateUser(id: number, data: { bio?: string; avatarEmoji?: string }): User | undefined;
  updatePassword(id: number, newPasswordHash: string): void;
  getTopUsers(limit?: number): User[];
  getAllUsers(): User[];

  // Builds
  getBuilds(filters?: { gameId?: number; seasonId?: number | null; gameModeId?: number; className?: string; mastery?: string }): BuildWithSubmitter[];
  getBuild(id: number): BuildWithSubmitter | undefined;
  createBuild(build: InsertBuild): Build;
  getUserBuilds(userId: number): BuildWithSubmitter[];
  deleteBuild(id: number): void;
  updateBuildSocialMetrics(id: number, data: {
    socialScore?: number; socialViews?: number; socialShares?: number;
    isTrending?: boolean; isViral?: boolean; trendingReason?: string;
  }): BuildWithSubmitter | undefined;
  getTrendingBuilds(): BuildWithSubmitter[];
  getViralBuilds(): BuildWithSubmitter[];

  // Votes (legacy)
  getVote(buildId: number, userId: number): Vote | undefined;
  castVote(buildId: number, userId: number, voteType: string): Vote;
  removeVote(buildId: number, userId: number): void;
  getUserVotes(userId: number): Vote[];

  // Tier votes
  getTierVote(buildId: number, userId: number): TierVote | undefined;
  getAnonTierVote(buildId: number, voterHash: string): AnonTierVote | undefined;
  castTierVote(buildId: number, userId: number, tierVote: string): TierVote;
  castAnonTierVote(buildId: number, voterHash: string, tierVote: string): AnonTierVote;
  removeTierVote(buildId: number, userId: number): void;
  removeAnonTierVote(buildId: number, voterHash: string): void;
  getUserTierVotes(userId: number): TierVote[];
  getAnonTierVotes(voterHash: string): AnonTierVote[];
  getVoteDistribution(buildId: number): Record<string, number>;
  recalculateBuildTier(buildId: number): void;
  migrateAnonTierVotes(voterHash: string, userId: number): void;

  // Bookmarks
  getBookmark(buildId: number, userId: number): Bookmark | undefined;
  toggleBookmark(buildId: number, userId: number): { action: "added" | "removed" };
  getUserBookmarks(userId: number): BuildWithSubmitter[];
  getAnonBookmark(buildId: number, voterHash: string): AnonBookmark | undefined;
  toggleAnonBookmark(buildId: number, voterHash: string): { action: "added" | "removed" };
  getAnonBookmarks(voterHash: string): AnonBookmark[];
  getBookmarkCount(buildId: number): number;
  migrateAnonBookmarks(voterHash: string, userId: number): void;

  // Reports
  createReport(buildId: number, voterHash: string, reason: string): Report;
  getReports(): Report[];
  deleteReport(id: number): void;

  // Social posts
  createSocialPost(post: InsertSocialPost): SocialPost;
  getSocialPosts(filters?: { platform?: string; status?: string; gameId?: number }): SocialPost[];
  getSocialPost(id: number): SocialPost | undefined;
  updateSocialPostStatus(id: number, status: string): SocialPost | undefined;
  deleteSocialPost(id: number): void;
  getSocialPostsForBuild(buildId: number): SocialPost[];
  deleteSocialPostsForBuild(buildId: number): void;
  hasSocialPostsForBuild(buildId: number): boolean;
  getSocialStats(): { pending: number; postedThisWeek: number; byPlatform: Record<string, number> };
}

// ─── Database storage ──────────────────────────────────────────

export class DatabaseStorage implements IStorage {

  // ── Categories ──

  getCategories(): Category[] {
    return db.select().from(categories).orderBy(categories.sortOrder).all();
  }

  getCategory(id: number): Category | undefined {
    return db.select().from(categories).where(eq(categories.id, id)).get();
  }

  getCategoryBySlug(slug: string): Category | undefined {
    return db.select().from(categories).where(eq(categories.slug, slug)).get();
  }

  createCategory(cat: InsertCategory): Category {
    return db.insert(categories).values({ ...cat, createdAt: new Date().toISOString() }).returning().get();
  }

  updateCategory(id: number, data: Partial<InsertCategory>): Category | undefined {
    db.update(categories).set(data).where(eq(categories.id, id)).run();
    return this.getCategory(id);
  }

  deleteCategory(id: number): void {
    // Reassign games from deleted category to "other" in the text category field
    const cat = this.getCategory(id);
    if (cat) {
      db.run(sql`UPDATE games SET category = 'other' WHERE category = ${cat.slug}`);
    }
    db.delete(categories).where(eq(categories.id, id)).run();
  }

  // ── Games ──

  getGames(): Game[] {
    return db.select().from(games)
      .where(eq(games.isActive, true))
      .orderBy(desc(games.sortOrder))
      .all();
  }

  getGame(id: number): Game | undefined {
    return db.select().from(games).where(eq(games.id, id)).get();
  }

  getGameBySlug(slug: string): Game | undefined {
    return db.select().from(games).where(eq(games.slug, slug)).get();
  }

  createGame(game: InsertGame): Game {
    return db.insert(games).values({ ...game, createdAt: new Date().toISOString() }).returning().get();
  }

  updateGame(id: number, data: Partial<InsertGame>): Game | undefined {
    db.update(games).set(data).where(eq(games.id, id)).run();
    return this.getGame(id);
  }

  deleteGame(id: number): void {
    db.update(games).set({ isActive: false }).where(eq(games.id, id)).run();
  }

  // ── Game modes ──

  getGameModes(gameId: number): GameMode[] {
    return db.select().from(gameModes)
      .where(eq(gameModes.gameId, gameId))
      .orderBy(gameModes.sortOrder)
      .all();
  }

  getGameMode(id: number): GameMode | undefined {
    return db.select().from(gameModes).where(eq(gameModes.id, id)).get();
  }

  getDefaultGameMode(gameId: number): GameMode | undefined {
    return db.select().from(gameModes)
      .where(and(eq(gameModes.gameId, gameId), eq(gameModes.isDefault, true)))
      .get();
  }

  createGameMode(mode: InsertGameMode): GameMode {
    return db.insert(gameModes).values(mode).returning().get();
  }

  updateGameMode(id: number, data: Partial<InsertGameMode>): GameMode | undefined {
    db.update(gameModes).set(data).where(eq(gameModes.id, id)).run();
    return this.getGameMode(id);
  }

  deleteGameMode(id: number): void {
    db.delete(gameModes).where(eq(gameModes.id, id)).run();
  }

  // ── Game classes ──

  getGameClasses(gameId: number): GameClass[] {
    return db.select().from(gameClasses).where(eq(gameClasses.gameId, gameId)).all();
  }

  getGameClass(id: number): GameClass | undefined {
    return db.select().from(gameClasses).where(eq(gameClasses.id, id)).get();
  }

  createGameClass(cls: InsertGameClass): GameClass {
    return db.insert(gameClasses).values(cls).returning().get();
  }

  updateGameClass(id: number, data: Partial<InsertGameClass>): GameClass | undefined {
    db.update(gameClasses).set(data).where(eq(gameClasses.id, id)).run();
    return this.getGameClass(id);
  }

  deleteGameClass(id: number): void {
    db.delete(gameClasses).where(eq(gameClasses.id, id)).run();
  }

  // ── Seasons ──

  getSeasons(): Season[] {
    return db.select().from(seasons).orderBy(desc(seasons.sortOrder)).all();
  }

  getSeasonsByGame(gameId: number): Season[] {
    return db.select().from(seasons)
      .where(eq(seasons.gameId, gameId))
      .orderBy(desc(seasons.sortOrder))
      .all();
  }

  getActiveSeason(gameId?: number): Season | undefined {
    if (gameId !== undefined) {
      return db.select().from(seasons)
        .where(and(eq(seasons.gameId, gameId), eq(seasons.isActive, true)))
        .orderBy(desc(seasons.sortOrder))
        .get();
    }
    return db.select().from(seasons)
      .where(eq(seasons.isActive, true))
      .orderBy(desc(seasons.sortOrder))
      .get();
  }

  getSeason(id: number): Season | undefined {
    return db.select().from(seasons).where(eq(seasons.id, id)).get();
  }

  getSeasonBySlug(slug: string): Season | undefined {
    return db.select().from(seasons).where(eq(seasons.slug, slug)).get();
  }

  createSeason(season: InsertSeason): Season {
    return db.insert(seasons).values({ ...season, createdAt: new Date().toISOString() }).returning().get();
  }

  updateSeason(id: number, data: Partial<InsertSeason>): Season | undefined {
    db.update(seasons).set(data).where(eq(seasons.id, id)).run();
    return this.getSeason(id);
  }

  deleteSeason(id: number): void {
    db.delete(seasons).where(eq(seasons.id, id)).run();
  }

  // ── Users ──

  createUser(user: InsertUser): User {
    return db.insert(users).values({
      ...user,
      passwordHash: hashPassword(user.passwordHash),
      karma: 0,
      buildSubmissions: 0,
      isAdmin: false,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  getUserByUsername(username: string): User | undefined {
    return db.select().from(users).where(eq(users.username, username)).get();
  }

  getUserById(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  updateKarma(userId: number, delta: number): void {
    db.run(sql`UPDATE users SET karma = karma + ${delta} WHERE id = ${userId}`);
  }

  updateUser(id: number, data: { bio?: string; avatarEmoji?: string }): User | undefined {
    if (data.bio !== undefined) {
      db.run(sql`UPDATE users SET bio = ${data.bio} WHERE id = ${id}`);
    }
    if (data.avatarEmoji !== undefined) {
      db.run(sql`UPDATE users SET avatar_emoji = ${data.avatarEmoji} WHERE id = ${id}`);
    }
    return this.getUserById(id);
  }

  updatePassword(id: number, newPasswordHash: string): void {
    db.run(sql`UPDATE users SET password_hash = ${newPasswordHash} WHERE id = ${id}`);
  }

  getTopUsers(limit = 20): User[] {
    return db.select().from(users).orderBy(desc(users.karma)).limit(limit).all();
  }

  getAllUsers(): User[] {
    return db.select().from(users).orderBy(desc(users.karma)).all();
  }

  // ── Builds ──

  private getBookmarkCountForBuild(buildId: number): number {
    const userCount = (db.all(sql`SELECT count(*) as c FROM bookmarks WHERE build_id = ${buildId}`) as any[])[0]?.c ?? 0;
    const anonCount = (db.all(sql`SELECT count(*) as c FROM anon_bookmarks WHERE build_id = ${buildId}`) as any[])[0]?.c ?? 0;
    return userCount + anonCount;
  }

  private enrichBuild(build: Build): BuildWithSubmitter {
    const submitter = build.submitterId ? this.getUserById(build.submitterId) : undefined;
    const season = build.seasonId ? this.getSeason(build.seasonId) : undefined;
    const gameMode = build.gameModeId ? this.getGameMode(build.gameModeId) : undefined;
    const game = this.getGame(build.gameId);
    return {
      ...build,
      submitterName: submitter?.username ?? "Anonymous",
      submitterKarma: submitter?.karma ?? 0,
      submitterAvatar: submitter?.avatarEmoji ?? "🎮",
      seasonSlug: season?.slug ?? null,
      seasonName: season?.name ?? null,
      gameModeName: gameMode?.name ?? null,
      gameModeSlug: gameMode?.slug ?? null,
      gameName: game?.name ?? "Unknown",
      gameSlug: game?.slug ?? "",
      gameIcon: game?.icon ?? "⚔️",
      gameColor: game?.color ?? "#d4a537",
      bookmarkCount: this.getBookmarkCountForBuild(build.id),
      calculatedTier: build.calculatedTier ?? "N",
      tierVoteCount: build.tierVoteCount ?? 0,
    };
  }

  getBuilds(filters?: { gameId?: number; seasonId?: number | null; gameModeId?: number; className?: string; mastery?: string }): BuildWithSubmitter[] {
    const conditions: any[] = [];
    if (filters?.gameId !== undefined) conditions.push(eq(builds.gameId, filters.gameId));
    if (filters?.seasonId !== undefined && filters.seasonId !== null) conditions.push(eq(builds.seasonId, filters.seasonId));
    if (filters?.gameModeId !== undefined) conditions.push(eq(builds.gameModeId, filters.gameModeId));
    if (filters?.className) conditions.push(eq(builds.className, filters.className));
    if (filters?.mastery) conditions.push(eq(builds.mastery, filters.mastery));

    let rows: Build[];
    if (conditions.length > 0) {
      rows = db.select().from(builds).where(and(...conditions)).orderBy(desc(builds.createdAt)).all();
    } else {
      rows = db.select().from(builds).orderBy(desc(builds.createdAt)).all();
    }
    return rows.map(b => this.enrichBuild(b));
  }

  getBuild(id: number): BuildWithSubmitter | undefined {
    const row = db.select().from(builds).where(eq(builds.id, id)).get();
    return row ? this.enrichBuild(row) : undefined;
  }

  createBuild(build: InsertBuild): Build {
    const sourceType = detectSource(build.guideUrl);
    const created = db.insert(builds).values({
      ...build,
      sourceType,
      upvotes: 0,
      downvotes: 0,
      views: 0,
      socialScore: 0,
      socialViews: 0,
      socialShares: 0,
      isTrending: false,
      isViral: false,
      calculatedTier: "N",
      tierVoteCount: 0,
      createdAt: new Date().toISOString(),
    }).returning().get();

    if (build.submitterId) {
      db.run(sql`UPDATE users SET build_submissions = build_submissions + 1 WHERE id = ${build.submitterId}`);
    }

    return created;
  }

  getUserBuilds(userId: number): BuildWithSubmitter[] {
    const rows = db.select().from(builds)
      .where(eq(builds.submitterId, userId))
      .orderBy(desc(builds.createdAt))
      .all();
    return rows.map(b => this.enrichBuild(b));
  }

  deleteBuild(id: number): void {
    db.delete(builds).where(eq(builds.id, id)).run();
  }

  updateBuildSocialMetrics(id: number, data: {
    socialScore?: number; socialViews?: number; socialShares?: number;
    isTrending?: boolean; isViral?: boolean; trendingReason?: string;
  }): BuildWithSubmitter | undefined {
    const sets: string[] = [];
    if (data.socialScore !== undefined) db.run(sql`UPDATE builds SET social_score = ${data.socialScore} WHERE id = ${id}`);
    if (data.socialViews !== undefined) db.run(sql`UPDATE builds SET social_views = ${data.socialViews} WHERE id = ${id}`);
    if (data.socialShares !== undefined) db.run(sql`UPDATE builds SET social_shares = ${data.socialShares} WHERE id = ${id}`);
    if (data.isTrending !== undefined) db.run(sql`UPDATE builds SET is_trending = ${data.isTrending ? 1 : 0} WHERE id = ${id}`);
    if (data.isViral !== undefined) db.run(sql`UPDATE builds SET is_viral = ${data.isViral ? 1 : 0} WHERE id = ${id}`);
    if (data.trendingReason !== undefined) db.run(sql`UPDATE builds SET trending_reason = ${data.trendingReason} WHERE id = ${id}`);
    return this.getBuild(id);
  }

  getTrendingBuilds(): BuildWithSubmitter[] {
    const rows = db.select().from(builds)
      .where(eq(builds.isTrending, true))
      .orderBy(desc(builds.socialScore))
      .limit(20)
      .all();
    return rows.map(b => this.enrichBuild(b));
  }

  getViralBuilds(): BuildWithSubmitter[] {
    const rows = db.select().from(builds)
      .where(eq(builds.isViral, true))
      .orderBy(desc(builds.socialScore))
      .limit(20)
      .all();
    return rows.map(b => this.enrichBuild(b));
  }

  // ── Votes (legacy) ──

  getVote(buildId: number, userId: number): Vote | undefined {
    return db.select().from(votes)
      .where(and(eq(votes.buildId, buildId), eq(votes.userId, userId)))
      .get();
  }

  castVote(buildId: number, userId: number, voteType: string): Vote {
    const existing = this.getVote(buildId, userId);
    const build = db.select().from(builds).where(eq(builds.id, buildId)).get();
    if (!build) throw new Error("Build not found");

    if (existing) {
      if (existing.voteType === "up") {
        db.run(sql`UPDATE builds SET upvotes = upvotes - 1 WHERE id = ${buildId}`);
      } else {
        db.run(sql`UPDATE builds SET downvotes = downvotes - 1 WHERE id = ${buildId}`);
      }
      const oldDelta = existing.voteType === "up" ? -1 : 1;
      if (build.submitterId) this.updateKarma(build.submitterId, oldDelta);

      db.delete(votes).where(and(eq(votes.buildId, buildId), eq(votes.userId, userId))).run();
    }

    const newVote = db.insert(votes).values({
      buildId, userId, voteType, createdAt: new Date().toISOString(),
    }).returning().get();

    if (voteType === "up") {
      db.run(sql`UPDATE builds SET upvotes = upvotes + 1 WHERE id = ${buildId}`);
      if (build.submitterId) this.updateKarma(build.submitterId, 1);
    } else {
      db.run(sql`UPDATE builds SET downvotes = downvotes + 1 WHERE id = ${buildId}`);
      if (build.submitterId) this.updateKarma(build.submitterId, -1);
    }

    return newVote;
  }

  removeVote(buildId: number, userId: number): void {
    const existing = this.getVote(buildId, userId);
    if (!existing) return;

    const build = db.select().from(builds).where(eq(builds.id, buildId)).get();
    if (!build) return;

    if (existing.voteType === "up") {
      db.run(sql`UPDATE builds SET upvotes = upvotes - 1 WHERE id = ${buildId}`);
      if (build.submitterId) this.updateKarma(build.submitterId, -1);
    } else {
      db.run(sql`UPDATE builds SET downvotes = downvotes - 1 WHERE id = ${buildId}`);
      if (build.submitterId) this.updateKarma(build.submitterId, 1);
    }
    db.delete(votes).where(and(eq(votes.buildId, buildId), eq(votes.userId, userId))).run();
  }

  getUserVotes(userId: number): Vote[] {
    return db.select().from(votes).where(eq(votes.userId, userId)).all();
  }

  // ── Tier Votes ──

  getTierVote(buildId: number, userId: number): TierVote | undefined {
    return db.select().from(tierVotes)
      .where(and(eq(tierVotes.buildId, buildId), eq(tierVotes.userId, userId)))
      .get();
  }

  getAnonTierVote(buildId: number, voterHash: string): AnonTierVote | undefined {
    const row = db.all(sql`SELECT * FROM anon_tier_votes WHERE build_id = ${buildId} AND voter_hash = ${voterHash}`) as any[];
    return row[0] as AnonTierVote | undefined;
  }

  castTierVote(buildId: number, userId: number, tierVote: string): TierVote {
    const existing = this.getTierVote(buildId, userId);
    if (existing) {
      db.run(sql`UPDATE tier_votes SET tier_vote = ${tierVote}, created_at = ${new Date().toISOString()} WHERE build_id = ${buildId} AND user_id = ${userId}`);
    } else {
      db.run(sql`INSERT INTO tier_votes (build_id, user_id, tier_vote, created_at) VALUES (${buildId}, ${userId}, ${tierVote}, ${new Date().toISOString()})`);
    }
    this.recalculateBuildTier(buildId);
    return this.getTierVote(buildId, userId)!;
  }

  castAnonTierVote(buildId: number, voterHash: string, tierVote: string): AnonTierVote {
    const existing = this.getAnonTierVote(buildId, voterHash);
    if (existing) {
      db.run(sql`UPDATE anon_tier_votes SET tier_vote = ${tierVote}, created_at = ${new Date().toISOString()} WHERE build_id = ${buildId} AND voter_hash = ${voterHash}`);
    } else {
      db.run(sql`INSERT INTO anon_tier_votes (build_id, voter_hash, tier_vote, created_at) VALUES (${buildId}, ${voterHash}, ${tierVote}, ${new Date().toISOString()})`);
    }
    this.recalculateBuildTier(buildId);
    return this.getAnonTierVote(buildId, voterHash)!;
  }

  removeTierVote(buildId: number, userId: number): void {
    db.run(sql`DELETE FROM tier_votes WHERE build_id = ${buildId} AND user_id = ${userId}`);
    this.recalculateBuildTier(buildId);
  }

  removeAnonTierVote(buildId: number, voterHash: string): void {
    db.run(sql`DELETE FROM anon_tier_votes WHERE build_id = ${buildId} AND voter_hash = ${voterHash}`);
    this.recalculateBuildTier(buildId);
  }

  getUserTierVotes(userId: number): TierVote[] {
    return db.select().from(tierVotes).where(eq(tierVotes.userId, userId)).all();
  }

  getAnonTierVotes(voterHash: string): AnonTierVote[] {
    return db.all(sql`SELECT * FROM anon_tier_votes WHERE voter_hash = ${voterHash}`) as AnonTierVote[];
  }

  getVoteDistribution(buildId: number): Record<string, number> {
    const dist: Record<string, number> = { "S+": 0, "S": 0, "A": 0, "B": 0, "C": 0, "D": 0 };
    const userRows = db.all(sql`SELECT tier_vote, count(*) as c FROM tier_votes WHERE build_id = ${buildId} GROUP BY tier_vote`) as any[];
    const anonRows = db.all(sql`SELECT tier_vote, count(*) as c FROM anon_tier_votes WHERE build_id = ${buildId} GROUP BY tier_vote`) as any[];
    for (const r of [...userRows, ...anonRows]) {
      if (dist[r.tier_vote] !== undefined) dist[r.tier_vote] += r.c;
    }
    return dist;
  }

  recalculateBuildTier(buildId: number): void {
    const TIER_VALUES: Record<string, number> = { "S+": 6, "S": 5, "A": 4, "B": 3, "C": 2, "D": 1 };
    const TIER_BY_VALUE: Record<number, string> = { 6: "S+", 5: "S", 4: "A", 3: "B", 2: "C", 1: "D" };

    const userRows = db.all(sql`SELECT tier_vote FROM tier_votes WHERE build_id = ${buildId}`) as any[];
    const anonRows = db.all(sql`SELECT tier_vote FROM anon_tier_votes WHERE build_id = ${buildId}`) as any[];
    const allVotes = [...userRows, ...anonRows].map(r => r.tier_vote as string);

    const total = allVotes.length;

    if (total === 0) {
      db.run(sql`UPDATE builds SET calculated_tier = 'N', tier_vote_count = 0 WHERE id = ${buildId}`);
      return;
    }

    const values = allVotes.map(v => TIER_VALUES[v] ?? 3).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const medianValue = values.length % 2 === 0
      ? Math.round((values[mid - 1] + values[mid]) / 2)
      : values[mid];
    const medianTier = TIER_BY_VALUE[medianValue] ?? "B";

    db.run(sql`UPDATE builds SET calculated_tier = ${medianTier}, tier_vote_count = ${total} WHERE id = ${buildId}`);
  }

  migrateAnonTierVotes(voterHash: string, userId: number): void {
    const anonRows = this.getAnonTierVotes(voterHash);
    for (const row of anonRows) {
      const existing = this.getTierVote(row.buildId, userId);
      if (!existing) {
        db.run(sql`INSERT INTO tier_votes (build_id, user_id, tier_vote, created_at) VALUES (${row.buildId}, ${userId}, ${row.tierVote}, ${new Date().toISOString()})`);
      }
    }
    db.run(sql`DELETE FROM anon_tier_votes WHERE voter_hash = ${voterHash}`);
  }

  // ── Bookmarks ──

  getBookmark(buildId: number, userId: number): Bookmark | undefined {
    const row = db.all(sql`SELECT * FROM bookmarks WHERE build_id = ${buildId} AND user_id = ${userId}`) as any[];
    return row[0] as Bookmark | undefined;
  }

  toggleBookmark(buildId: number, userId: number): { action: "added" | "removed" } {
    const existing = this.getBookmark(buildId, userId);
    if (existing) {
      db.run(sql`DELETE FROM bookmarks WHERE build_id = ${buildId} AND user_id = ${userId}`);
      return { action: "removed" };
    } else {
      db.run(sql`INSERT INTO bookmarks (user_id, build_id, created_at) VALUES (${userId}, ${buildId}, ${new Date().toISOString()})`);
      return { action: "added" };
    }
  }

  getUserBookmarks(userId: number): BuildWithSubmitter[] {
    const rows = db.all(sql`SELECT build_id FROM bookmarks WHERE user_id = ${userId} ORDER BY created_at DESC`) as any[];
    const result: BuildWithSubmitter[] = [];
    for (const row of rows) {
      const build = this.getBuild(row.build_id);
      if (build) result.push(build);
    }
    return result;
  }

  getAnonBookmark(buildId: number, voterHash: string): AnonBookmark | undefined {
    const row = db.all(sql`SELECT * FROM anon_bookmarks WHERE build_id = ${buildId} AND voter_hash = ${voterHash}`) as any[];
    return row[0] as AnonBookmark | undefined;
  }

  toggleAnonBookmark(buildId: number, voterHash: string): { action: "added" | "removed" } {
    const existing = this.getAnonBookmark(buildId, voterHash);
    if (existing) {
      db.run(sql`DELETE FROM anon_bookmarks WHERE build_id = ${buildId} AND voter_hash = ${voterHash}`);
      return { action: "removed" };
    } else {
      db.run(sql`INSERT INTO anon_bookmarks (build_id, voter_hash, created_at) VALUES (${buildId}, ${voterHash}, ${new Date().toISOString()})`);
      return { action: "added" };
    }
  }

  getAnonBookmarks(voterHash: string): AnonBookmark[] {
    return db.all(sql`SELECT * FROM anon_bookmarks WHERE voter_hash = ${voterHash}`) as AnonBookmark[];
  }

  getBookmarkCount(buildId: number): number {
    return this.getBookmarkCountForBuild(buildId);
  }

  migrateAnonBookmarks(voterHash: string, userId: number): void {
    const anonBms = this.getAnonBookmarks(voterHash);
    for (const bm of anonBms) {
      const existing = this.getBookmark(bm.buildId, userId);
      if (!existing) {
        db.run(sql`INSERT INTO bookmarks (user_id, build_id, created_at) VALUES (${userId}, ${bm.buildId}, ${new Date().toISOString()})`);
      }
    }
    db.run(sql`DELETE FROM anon_bookmarks WHERE voter_hash = ${voterHash}`);
  }

  // ── Reports ──

  createReport(buildId: number, voterHash: string, reason: string): Report {
    // Upsert — one report per voter per build
    const existing = (db.all(sql`SELECT * FROM reports WHERE build_id = ${buildId} AND voter_hash = ${voterHash}`) as any[])[0];
    if (existing) return existing as Report;
    db.run(sql`INSERT INTO reports (build_id, voter_hash, reason, created_at) VALUES (${buildId}, ${voterHash}, ${reason}, ${new Date().toISOString()})`);
    return (db.all(sql`SELECT * FROM reports WHERE build_id = ${buildId} AND voter_hash = ${voterHash}`) as any[])[0] as Report;
  }

  getReports(): Report[] {
    return db.all(sql`SELECT r.*, b.name as build_name, g.name as game_name FROM reports r LEFT JOIN builds b ON b.id = r.build_id LEFT JOIN games g ON g.id = b.game_id ORDER BY r.created_at DESC`) as Report[];
  }

  deleteReport(id: number): void {
    db.run(sql`DELETE FROM reports WHERE id = ${id}`);
  }

  // ── Social posts ──

  createSocialPost(post: InsertSocialPost): SocialPost {
    return db.insert(socialPosts).values(post).returning().get();
  }

  getSocialPosts(filters?: { platform?: string; status?: string; gameId?: number }): SocialPost[] {
    const conditions: any[] = [];
    if (filters?.platform) conditions.push(eq(socialPosts.platform, filters.platform));
    if (filters?.status) conditions.push(eq(socialPosts.status, filters.status));
    if (filters?.gameId) conditions.push(eq(socialPosts.gameId, filters.gameId));

    if (conditions.length > 0) {
      return db.select().from(socialPosts).where(and(...conditions)).orderBy(desc(socialPosts.createdAt)).all();
    }
    return db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt)).all();
  }

  getSocialPost(id: number): SocialPost | undefined {
    return db.select().from(socialPosts).where(eq(socialPosts.id, id)).get();
  }

  updateSocialPostStatus(id: number, status: string): SocialPost | undefined {
    db.run(sql`UPDATE social_posts SET status = ${status} WHERE id = ${id}`);
    return this.getSocialPost(id);
  }

  deleteSocialPost(id: number): void {
    db.delete(socialPosts).where(eq(socialPosts.id, id)).run();
  }

  getSocialPostsForBuild(buildId: number): SocialPost[] {
    return db.select().from(socialPosts).where(eq(socialPosts.buildId, buildId)).all();
  }

  deleteSocialPostsForBuild(buildId: number): void {
    db.run(sql`DELETE FROM social_posts WHERE build_id = ${buildId}`);
  }

  hasSocialPostsForBuild(buildId: number): boolean {
    const row = db.all(sql`SELECT count(*) as c FROM social_posts WHERE build_id = ${buildId}`) as any[];
    return (row[0]?.c ?? 0) > 0;
  }

  getSocialStats(): { pending: number; postedThisWeek: number; byPlatform: Record<string, number> } {
    const pending = (db.all(sql`SELECT count(*) as c FROM social_posts WHERE status = 'pending'`) as any[])[0]?.c ?? 0;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const postedThisWeek = (db.all(sql`SELECT count(*) as c FROM social_posts WHERE status = 'posted' AND created_at >= ${weekAgo}`) as any[])[0]?.c ?? 0;

    const platformRows = db.all(sql`SELECT platform, count(*) as c FROM social_posts GROUP BY platform`) as any[];
    const byPlatform: Record<string, number> = {};
    for (const row of platformRows) {
      byPlatform[row.platform] = row.c;
    }

    return { pending, postedThisWeek, byPlatform };
  }
}

export const storage = new DatabaseStorage();
