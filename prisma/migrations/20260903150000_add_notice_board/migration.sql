-- 掲示板形式のお知らせ機能。全スタッフが投稿・編集できる。
CREATE TABLE "Notice" (
  "id" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "editedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notice_createdAt_idx" ON "Notice"("createdAt");

ALTER TABLE "Notice"
ADD CONSTRAINT "Notice_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
