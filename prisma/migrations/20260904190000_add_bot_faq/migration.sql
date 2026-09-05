-- サポートBOTのFAQ管理機能。
CREATE TYPE "BotFaqAudience" AS ENUM ('STAFF', 'CLIENT');

CREATE TABLE "BotFaq" (
  "id" TEXT NOT NULL,
  "audience" "BotFaqAudience" NOT NULL,
  "category" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "keywords" TEXT,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BotFaq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BotFaq_audience_visible_sortOrder_idx" ON "BotFaq"("audience", "visible", "sortOrder");

-- 既存のBOT回答内容(コード内に直書きされていたもの)を、そのままFAQ管理に
-- 移行する初期データ。これを入れないと、デプロイ直後はBOTのトピック一覧が
-- 空になってしまうため、テーブル作成と同時に必ず実行してください。
INSERT INTO "BotFaq" (id, audience, category, question, answer, keywords, visible, "sortOrder", "createdAt", "updatedAt") VALUES
(gen_random_uuid()::text, 'STAFF', '勤怠', '出勤・退勤について', '文字通りです。押してください。ミスったら5分以内であれば修正できます。位置情報も自動回収なので余計な事は考えないように。', '出勤,退勤,打刻,再出勤,勤務開始,勤務終了', true, 10, now(), now()),
(gen_random_uuid()::text, 'STAFF', '勤怠', 'シフトを確認・変更したい', 'シフトが確定したら確定分を入力してください。受取予定報酬額も確定している場合は入力してください。', 'シフト,予定,勤務日,変更,休み', true, 20, now(), now()),
(gen_random_uuid()::text, 'STAFF', '支払', '確定金額・支払日を確認したい', 'ホームからどうぞ確認してください。', '金額,給料,報酬,支払,振込,確定,受取', true, 30, now(), now()),
(gen_random_uuid()::text, 'STAFF', '申請', '交通費・経費を申請したい', 'メニューからすすんで申請してください。領収書は写真等で経理課（keiri@kjgroup.info）に送っておいてください。洩れたら振り込みませんよからね。', '交通費,経費,高速,宿泊,ガソリン,申請', true, 40, now(), now()),
(gen_random_uuid()::text, 'STAFF', '販売サポート', 'MNP・予約番号について調べたい', 'ここで聞くな。Googleあるだろ。', 'MNP,予約番号,転出,番号移行,乗り換え', true, 50, now(), now()),
(gen_random_uuid()::text, 'STAFF', '販売サポート', '料金プランについて調べたい', '調べてください。', 'プラン,料金,ギガ,GB,割引,料金プラン', true, 60, now(), now()),
(gen_random_uuid()::text, 'STAFF', '販売サポート', '機種・端末について調べたい', 'そういうのはチャッピーにやらせとけばいいんだよ。', '機種,端末,iPhone,Pixel,Android,eSIM,SIM', true, 70, now(), now()),
(gen_random_uuid()::text, 'STAFF', '雑談', '仕事行きたくない', '皆そうです。行ってください。', '仕事行きたくない,行きたくない,サボりたい,仕事だるい', true, 80, now(), now()),
(gen_random_uuid()::text, 'STAFF', '雑談', '体調が悪い', '気のせいです。頑張ってください。', '体調が悪い,体調不良,しんどい,だるい', true, 90, now(), now()),
(gen_random_uuid()::text, 'STAFF', '雑談', 'マジで体調が悪い', '上長の承認取って、即現場責任者等に連絡してください。', 'マジで体調が悪い,本当に体調が悪い,高熱,動けない,救急', true, 100, now(), now()),
(gen_random_uuid()::text, 'STAFF', '雑談', '飲みに行きたい', '俺も', '飲みに行きたい,飲み会,飲みたい,飲みに行く', true, 110, now(), now()),
(gen_random_uuid()::text, 'CLIENT', '稼働依頼', '稼働を依頼したい', '稼働依頼フォームから、会社名・ご担当者様・稼働場所・依頼内容・単価などをご入力ください。担当者様メールアドレスは任意です。', '依頼,稼働,申し込み,申込,スタッフ', true, 10, now(), now()),
(gen_random_uuid()::text, 'CLIENT', '稼働依頼', '依頼後の流れを知りたい', '送信された稼働依頼はK.J管理側で確認します。承認後は専用ページから依頼状況・勤怠・請求情報を確認できます。', '流れ,承認,依頼後,ステータス,状況', true, 20, now(), now()),
(gen_random_uuid()::text, 'CLIENT', '稼働依頼', '依頼内容を変更したい', '依頼内容の変更や追加が必要な場合は、対象の依頼内容が分かる状態でK.J担当者へご連絡ください。', '変更,修正,キャンセル,中止,追加', true, 30, now(), now()),
(gen_random_uuid()::text, 'CLIENT', '確認', 'スタッフの勤怠を確認したい', '承認済みの依頼は専用ページからスタッフの勤怠状況を確認できます。表示は自動更新されます。', '勤怠,出勤,退勤,勤務,時間', true, 40, now(), now()),
(gen_random_uuid()::text, 'CLIENT', '請求', '請求書・明細を確認したい', '請求確定後、専用ページから請求書PDFと勤務・請求明細を確認できます。', '請求,請求書,明細,PDF,金額', true, 50, now(), now()),
(gen_random_uuid()::text, 'CLIENT', 'スタッフ', '稼働スタッフについて', '稼働スタッフ名は依頼時に入力できます。登録済みスタッフ一覧にいない方でも、名前を直接入力して依頼できます。', 'スタッフ,稼働者,人員,人数,名前', true, 60, now(), now());
