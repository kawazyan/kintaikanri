-- CreateEnum
CREATE TYPE "GameTitleCode" AS ENUM ('CHALLENGER', 'TOP_PLAYER', 'EXECUTIVE', 'PLATINUM_MASTER', 'LEGEND');

-- CreateTable
CREATE TABLE "GameTitle" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "titleCode" "GameTitleCode" NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfectAttendance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfectAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameTitle_staffId_titleCode_key" ON "GameTitle"("staffId", "titleCode");

-- CreateIndex
CREATE UNIQUE INDEX "PerfectAttendance_staffId_yearMonth_key" ON "PerfectAttendance"("staffId", "yearMonth");

-- AddForeignKey
ALTER TABLE "GameTitle" ADD CONSTRAINT "GameTitle_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfectAttendance" ADD CONSTRAINT "PerfectAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
