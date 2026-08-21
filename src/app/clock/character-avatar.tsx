import Image from "next/image";

export type AvatarState = "HOME" | "WORK" | "NIGHT";

const AVATAR_SRC: Record<AvatarState, string> = {
  HOME: "/characters/avatar-home.png",
  WORK: "/characters/avatar-work.png",
  NIGHT: "/characters/avatar-night.png",
};

const AVATAR_LABEL: Record<AvatarState, string> = {
  HOME: "未出勤",
  WORK: "出勤中",
  NIGHT: "退勤済み",
};

export function CharacterAvatar({ state }: { state: AvatarState }) {
  return (
    <div className="relative -mx-4 h-64 overflow-hidden">
      <Image
        src={AVATAR_SRC[state]}
        alt={AVATAR_LABEL[state]}
        fill
        sizes="100vw"
        className="object-cover object-top"
        priority
      />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#05070f] to-transparent" />
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 px-3 py-0.5 text-xs font-medium text-blue-300 shadow-md shadow-black/40 ring-1 ring-blue-500/30">
        {AVATAR_LABEL[state]}
      </span>
    </div>
  );
}
