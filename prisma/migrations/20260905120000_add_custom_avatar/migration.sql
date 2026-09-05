-- キャラクター変更で「自分の写真」を選べるようにするための保存先。
ALTER TABLE "Staff" ADD COLUMN "customAvatarHome" TEXT;
ALTER TABLE "Staff" ADD COLUMN "customAvatarWork" TEXT;
ALTER TABLE "Staff" ADD COLUMN "customAvatarNight" TEXT;
