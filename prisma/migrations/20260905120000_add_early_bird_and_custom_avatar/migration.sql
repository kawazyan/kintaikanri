-- 特別称号「EARLY_BIRD」(勤務開始時刻より前に出勤打刻)の追加。
ALTER TYPE "GameTitleCode" ADD VALUE 'EARLY_BIRD';

-- キャラクター変更で「自分の写真」を選べるようにするための保存先。
ALTER TABLE "Staff" ADD COLUMN "customAvatarHome" TEXT;
ALTER TABLE "Staff" ADD COLUMN "customAvatarWork" TEXT;
ALTER TABLE "Staff" ADD COLUMN "customAvatarNight" TEXT;
