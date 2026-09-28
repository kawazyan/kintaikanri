CREATE TABLE "AlertMessageSetting" (
    "key" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertMessageSetting_pkey" PRIMARY KEY ("key")
);
