/*
  Warnings:

  - You are about to drop the column `siteId` on the `ClockRecord` table. All the data in the column will be lost.
  - You are about to drop the column `clientName` on the `Shift` table. All the data in the column will be lost.
  - You are about to drop the column `siteId` on the `Shift` table. All the data in the column will be lost.
  - You are about to drop the `Site` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `carrier` to the `Shift` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeName` to the `Shift` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workType` to the `Shift` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('BAND', 'SPOT');

-- DropForeignKey
ALTER TABLE "ClockRecord" DROP CONSTRAINT "ClockRecord_siteId_fkey";

-- DropForeignKey
ALTER TABLE "NoShowAlert" DROP CONSTRAINT "NoShowAlert_shiftId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_siteId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftHistory" DROP CONSTRAINT "ShiftHistory_shiftId_fkey";

-- AlterTable
ALTER TABLE "ClockRecord" DROP COLUMN "siteId",
ADD COLUMN     "storeName" TEXT;

-- AlterTable
ALTER TABLE "Shift" DROP COLUMN "clientName",
DROP COLUMN "siteId",
ADD COLUMN     "carrier" TEXT NOT NULL,
ADD COLUMN     "storeName" TEXT NOT NULL,
ADD COLUMN     "workType" "WorkType" NOT NULL;

-- AlterTable
ALTER TABLE "ShiftHistory" ALTER COLUMN "shiftId" DROP NOT NULL;

-- DropTable
DROP TABLE "Site";

-- AddForeignKey
ALTER TABLE "ShiftHistory" ADD CONSTRAINT "ShiftHistory_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowAlert" ADD CONSTRAINT "NoShowAlert_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
