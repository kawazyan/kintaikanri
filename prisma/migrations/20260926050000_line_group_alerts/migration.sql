ALTER TABLE "Staff" ADD COLUMN "lineGroupId" TEXT;
ALTER TABLE "Staff" ADD COLUMN "lineLinkCode" TEXT;

CREATE UNIQUE INDEX "Staff_lineGroupId_key" ON "Staff"("lineGroupId");
CREATE UNIQUE INDEX "Staff_lineLinkCode_key" ON "Staff"("lineLinkCode");

CREATE TABLE "LineAlert" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LineAlert_shiftId_key" ON "LineAlert"("shiftId");
ALTER TABLE "LineAlert" ADD CONSTRAINT "LineAlert_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
