import type { GameTitleCode } from "@prisma/client";

// ゲーミフィケーション機能の対象開始日(JST calendar date, "YYYY-MM-DD")。
// リリース前の打刻履歴には遡及しない(仕様書 注意点参照)。この値だけを
// 変更すれば対象開始日を後から調整できる。
export const GAME_FEATURE_START_DATE = "2026-08-21";

// 1勤務達成(出勤+退勤の両方が揃った日)ごとに付与する固定値。後で調整可能。
export const XP_PER_SHIFT = 50;
export const COINS_PER_SHIFT = 30;

// レベルアップに必要なXP。レベルNからN+1に上がるには N * LEVEL_XP_BASE が必要
// (緩やかな右肩上がり)。
export const LEVEL_XP_BASE = 100;

// 月間スタンプカードの目標勤務達成数とボーナスコイン(stamp-card-mockup.htmlの
// 表示例と一致させている: 「20日達成でボーナスコイン+200」)。
export const STAMP_MONTHLY_TARGET_DAYS = 20;
export const STAMP_MONTHLY_BONUS_COINS = 200;

export type TitleDefinition = {
  code: GameTitleCode;
  label: string;
  minStreak: number;
};

// 連続勤務ストリークの閾値で獲得する通常称号。一度獲得したら永久保持。
export const TITLE_DEFINITIONS: TitleDefinition[] = [
  { code: "CHALLENGER", label: "CHALLENGER", minStreak: 3 },
  { code: "TOP_PLAYER", label: "TOP PLAYER", minStreak: 8 },
  { code: "EXECUTIVE", label: "EXECUTIVE", minStreak: 13 },
  { code: "PLATINUM_MASTER", label: "PLATINUM MASTER", minStreak: 17 },
  { code: "LEGEND", label: "LEGEND", minStreak: 21 },
];

export type SpecialTitleDefinition = {
  code: GameTitleCode;
  label: string;
  description: string;
};

// 連続勤務ストリークとは無関係に、特定の行動が条件で獲得する称号。
// 一度獲得したら永久保持(通常称号と同じ扱い)。
export const SPECIAL_TITLE_DEFINITIONS: SpecialTitleDefinition[] = [
  { code: "EARLY_BIRD", label: "EARLY BIRD", description: "勤務開始時刻より前に出勤打刻すると獲得" },
];
