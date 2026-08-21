import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Vercel deploys each route as its own serverless function, and each cold
  // start creates a brand-new pg.Pool (default max: 10 connections). With
  // many routes and Supabase's Session pooler capped at 15 total clients,
  // that was exhausting the pool ("max clients reached in session mode").
  // Capping each instance's pool to a single connection keeps the app's
  // total connection usage well under that limit; a warm Lambda instance
  // still reuses this same pool/connection across requests via the
  // module-level singleton below.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
