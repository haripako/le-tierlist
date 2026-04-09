import { builds, votes, type Build, type InsertBuild, type Vote, type InsertVote } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Builds
  getBuilds(filters?: { seasonId?: string; gameMode?: string; className?: string; mastery?: string }): Build[];
  getBuild(id: number): Build | undefined;
  createBuild(build: InsertBuild): Build;
  
  // Votes
  getVote(buildId: number, voterId: string): Vote | undefined;
  castVote(vote: InsertVote): Vote;
  removeVote(buildId: number, voterId: string): void;
  getVoterVotes(voterId: string): Vote[];
}

export class DatabaseStorage implements IStorage {
  getBuilds(filters?: { seasonId?: string; gameMode?: string; className?: string; mastery?: string }): Build[] {
    let query = db.select().from(builds);
    
    const conditions = [];
    if (filters?.seasonId) conditions.push(eq(builds.seasonId, filters.seasonId));
    if (filters?.gameMode) conditions.push(eq(builds.gameMode, filters.gameMode));
    if (filters?.className) conditions.push(eq(builds.className, filters.className));
    if (filters?.mastery) conditions.push(eq(builds.mastery, filters.mastery));
    
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(builds.upvotes)).all();
    }
    return query.orderBy(desc(builds.upvotes)).all();
  }

  getBuild(id: number): Build | undefined {
    return db.select().from(builds).where(eq(builds.id, id)).get();
  }

  createBuild(build: InsertBuild): Build {
    return db.insert(builds).values({
      ...build,
      upvotes: 0,
      downvotes: 0,
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  getVote(buildId: number, voterId: string): Vote | undefined {
    return db.select().from(votes)
      .where(and(eq(votes.buildId, buildId), eq(votes.voterId, voterId)))
      .get();
  }

  castVote(vote: InsertVote): Vote {
    // Remove any existing vote first
    const existing = this.getVote(vote.buildId, vote.voterId);
    if (existing) {
      // Remove old vote effect
      if (existing.voteType === "up") {
        db.run(sql`UPDATE builds SET upvotes = upvotes - 1 WHERE id = ${vote.buildId}`);
      } else {
        db.run(sql`UPDATE builds SET downvotes = downvotes - 1 WHERE id = ${vote.buildId}`);
      }
      db.delete(votes)
        .where(and(eq(votes.buildId, vote.buildId), eq(votes.voterId, vote.voterId)))
        .run();
    }

    // Insert new vote
    const newVote = db.insert(votes).values({
      ...vote,
      createdAt: new Date().toISOString(),
    }).returning().get();

    // Add new vote effect
    if (vote.voteType === "up") {
      db.run(sql`UPDATE builds SET upvotes = upvotes + 1 WHERE id = ${vote.buildId}`);
    } else {
      db.run(sql`UPDATE builds SET downvotes = downvotes + 1 WHERE id = ${vote.buildId}`);
    }

    return newVote;
  }

  removeVote(buildId: number, voterId: string): void {
    const existing = this.getVote(buildId, voterId);
    if (existing) {
      if (existing.voteType === "up") {
        db.run(sql`UPDATE builds SET upvotes = upvotes - 1 WHERE id = ${buildId}`);
      } else {
        db.run(sql`UPDATE builds SET downvotes = downvotes - 1 WHERE id = ${buildId}`);
      }
      db.delete(votes)
        .where(and(eq(votes.buildId, buildId), eq(votes.voterId, voterId)))
        .run();
    }
  }

  getVoterVotes(voterId: string): Vote[] {
    return db.select().from(votes).where(eq(votes.voterId, voterId)).all();
  }

}

export const storage = new DatabaseStorage();
