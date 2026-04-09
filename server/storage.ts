import {
  games, gameClasses, seasons, users, builds, votes, anonVotes,
  type Game, type InsertGame,
  type GameClass, type InsertGameClass,
  type Season, type InsertSeason,
  type User, type InsertUser,
  type Build, type InsertBuild,
  type Vote, type InsertVote,
  type BuildWithSubmitter,
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
  // Games
  getGames(): Game[];
  getGame(id: number): Game | undefined;
  getGameBySlug(slug: string): Game | undefined;
  createGame(game: InsertGame): Game;
  updateGame(id: number, data: Partial<InsertGame>): Game | undefined;
  deleteGame(id: number): void;

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
  getTopUsers(limit?: number): User[];

  // Builds
  getBuilds(filters?: { gameId?: number; seasonId?: number | null; gameMode?: string; className?: string; mastery?: string }): BuildWithSubmitter[];
  getBuild(id: number): BuildWithSubmitter | undefined;
  createBuild(build: InsertBuild): Build;
  getUserBuilds(userId: number): BuildWithSubmitter[];

  // Votes
  getVote(buildId: number, userId: number): Vote | undefined;
  castVote(buildId: number, userId: number, voteType: string): Vote;
  removeVote(buildId: number, userId: number): void;
  getUserVotes(userId: number): Vote[];
}

// ─── Database storage ──────────────────────────────────────────

export class DatabaseStorage implements IStorage {

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

  getTopUsers(limit = 20): User[] {
    return db.select().from(users).orderBy(desc(users.karma)).limit(limit).all();
  }

  // ── Builds ──

  private enrichBuild(build: Build): BuildWithSubmitter {
    const submitter = build.submitterId ? this.getUserById(build.submitterId) : undefined;
    const season = build.seasonId ? this.getSeason(build.seasonId) : undefined;
    const game = this.getGame(build.gameId);
    return {
      ...build,
      submitterName: submitter?.username ?? "Anonymous",
      submitterKarma: submitter?.karma ?? 0,
      seasonSlug: season?.slug ?? null,
      seasonName: season?.name ?? null,
      gameName: game?.name ?? "Unknown",
      gameSlug: game?.slug ?? "",
      gameIcon: game?.icon ?? "⚔️",
      gameColor: game?.color ?? "#d4a537",
    };
  }

  getBuilds(filters?: { gameId?: number; seasonId?: number | null; gameMode?: string; className?: string; mastery?: string }): BuildWithSubmitter[] {
    const conditions: any[] = [];
    if (filters?.gameId !== undefined) conditions.push(eq(builds.gameId, filters.gameId));
    if (filters?.seasonId !== undefined && filters.seasonId !== null) conditions.push(eq(builds.seasonId, filters.seasonId));
    if (filters?.gameMode) conditions.push(eq(builds.gameMode, filters.gameMode));
    if (filters?.className) conditions.push(eq(builds.className, filters.className));
    if (filters?.mastery) conditions.push(eq(builds.mastery, filters.mastery));

    let rows: Build[];
    if (conditions.length > 0) {
      rows = db.select().from(builds).where(and(...conditions)).orderBy(desc(builds.upvotes)).all();
    } else {
      rows = db.select().from(builds).orderBy(desc(builds.upvotes)).all();
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

  // ── Votes ──

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
}

export const storage = new DatabaseStorage();
