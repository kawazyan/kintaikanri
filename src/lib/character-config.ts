// ホーム画面で選べるキャラクターの一覧。各キャラクターは
// public/characters/<id>/avatar-{home,work,night}.png の3枚組を持つ
// (詳細は public/characters/README.txt を参照)。
//
// 新しいキャラクターを追加する手順:
// 1. public/characters/<新しいid>/ に avatar-home.png / avatar-work.png /
//    avatar-night.png を配置
// 2. 下の CHARACTER_DEFINITIONS に { id, label } を追加
export type CharacterDefinition = {
  id: string;
  label: string;
};

// "none" = ホーム画面にキャラクターを表示しない。"custom" = 本人がアップロード
// した写真(Staff.customAvatarHome/Work/Night)を使う。どちらも public/characters
// 配下に画像フォルダを持たない特殊選択肢のため、表示側で個別に扱う。
export const NONE_CHARACTER_ID = "none";
export const CUSTOM_CHARACTER_ID = "custom";

export const CHARACTER_DEFINITIONS: CharacterDefinition[] = [
  { id: "default", label: "デフォルト" },
  { id: "vice-boy", label: "ViceBoy" },
  { id: "vice-girl", label: "ViceGirl" },
  { id: "boss-boy", label: "BossBoy" },
  { id: "boss-girl", label: "BossGirl" },
  { id: NONE_CHARACTER_ID, label: "表示なし" },
  { id: CUSTOM_CHARACTER_ID, label: "自分の写真" },
];

export const DEFAULT_CHARACTER_ID = "default";

export function isValidCharacterId(id: string): boolean {
  return CHARACTER_DEFINITIONS.some((c) => c.id === id);
}

export type AvatarState = "HOME" | "WORK" | "NIGHT";

const AVATAR_STATE_FILE: Record<AvatarState, string> = {
  HOME: "avatar-home.png",
  WORK: "avatar-work.png",
  NIGHT: "avatar-night.png",
};

export function avatarImagePath(characterId: string, state: AvatarState): string {
  return `/characters/${characterId}/${AVATAR_STATE_FILE[state]}`;
}

export type CustomAvatarUrls = {
  home: string | null;
  work: string | null;
  night: string | null;
};

// characterId="none"は非表示(null)、"custom"は本人アップロード写真(未設定の
// 状態が残っていればデフォルトキャラクターにフォールバック)、それ以外は通常の
// プリセット画像パスを返す。表示箇所(ホーム画面ヒーロー・メニューのプロフィール
// カード・キャラ変更ページのプレビュー)で共通して使う。
export function resolveAvatarSrc(
  characterId: string,
  state: AvatarState,
  custom?: CustomAvatarUrls | null
): string | null {
  if (characterId === NONE_CHARACTER_ID) return null;
  if (characterId === CUSTOM_CHARACTER_ID) {
    const uploaded = state === "HOME" ? custom?.home : state === "WORK" ? custom?.work : custom?.night;
    return uploaded || avatarImagePath(DEFAULT_CHARACTER_ID, state);
  }
  return avatarImagePath(characterId, state);
}
