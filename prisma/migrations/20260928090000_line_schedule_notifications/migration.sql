CREATE TABLE "PreShiftLineAlert" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreShiftLineAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PreShiftLineAlert_shiftId_key" ON "PreShiftLineAlert"("shiftId");
ALTER TABLE "PreShiftLineAlert" ADD CONSTRAINT "PreShiftLineAlert_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LineDailySummaryGroup" (
  "id" TEXT NOT NULL,
  "groupId" TEXT,
  "linkCode" TEXT,
  CONSTRAINT "LineDailySummaryGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LineDailySummaryGroup_groupId_key" ON "LineDailySummaryGroup"("groupId");
CREATE UNIQUE INDEX "LineDailySummaryGroup_linkCode_key" ON "LineDailySummaryGroup"("linkCode");

CREATE TABLE "LineDailySummary" (
  "dateKey" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineDailySummary_pkey" PRIMARY KEY ("dateKey")
);

ALTER TABLE "PreShiftLineAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LineDailySummaryGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LineDailySummary" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PreShiftLineAlert", "LineDailySummaryGroup", "LineDailySummary" FROM anon, authenticated;
