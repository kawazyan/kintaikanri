import "dotenv/config";
import { defineConfig } from "prisma/config";

// Get DATABASE_URL from environment, with fallback for build-time
const databaseUrl = process.env.DATABASE_URL || "postgresql://localhost/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
