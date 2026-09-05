-- サポートBOTのFAQ管理機能。
CREATE TYPE "BotFaqAudience" AS ENUM ('STAFF', 'CLIENT');

CREATE TABLE "BotFaq" (
  "id" TEXT NOT NULL,
  "audience" "BotFaqAudience" NOT NULL,
  "category" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "keywords" TEXT,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotFaq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BotFaq_audience_visible_sortOrder_idx" ON "BotFaq"("audience", "visible", "sortOrder");
