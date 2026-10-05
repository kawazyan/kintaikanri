-- Staff: simple attendance mode (buttons only: clock in/out, absent, late, early leave)
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "simpleMode" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "SimpleAttendanceKind" AS ENUM ('ABSENT', 'LATE', 'EARLY_LEAVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SimpleAttendanceEntry" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "kind" "SimpleAttendanceKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimpleAttendanceEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SimpleAttendanceEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SimpleAttendanceEntry_staffId_date_kind_key" ON "SimpleAttendanceEntry"("staffId","date","kind");
CREATE INDEX IF NOT EXISTS "SimpleAttendanceEntry_date_idx" ON "SimpleAttendanceEntry"("date");
