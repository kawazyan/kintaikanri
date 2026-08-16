-- CreateTable
CREATE TABLE "MonthlyEarningTarget" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "targetAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyEarningTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyEarningTarget_staffId_yearMonth_key" ON "MonthlyEarningTarget"("staffId", "yearMonth");

-- AddForeignKey
ALTER TABLE "MonthlyEarningTarget" ADD CONSTRAINT "MonthlyEarningTarget_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
