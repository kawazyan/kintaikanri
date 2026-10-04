-- CreateTable
CREATE TABLE "ClientViewToken" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ClientViewToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientViewToken_token_key" ON "ClientViewToken"("token");

-- CreateIndex
CREATE INDEX "ClientViewToken_clientId_active_idx" ON "ClientViewToken"("clientId", "active");

-- AddForeignKey
ALTER TABLE "ClientViewToken" ADD CONSTRAINT "ClientViewToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 既存テーブルに合わせてRLSを有効化(Supabase公開API経由でトークンを読ませない)
ALTER TABLE "ClientViewToken" ENABLE ROW LEVEL SECURITY;
