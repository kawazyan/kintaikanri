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

export const CHARACTER_DEFINITIONS: CharacterDefinition[] = [
  { id: "default", label: "デフォルト" },
  { id: "vice-boy", label: "ViceBoy" },
  { id: "vice-girl", label: "ViceGirl" },
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
