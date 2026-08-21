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
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-56 w-40 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-black/40">
        <Image
          src={AVATAR_SRC[state]}
          alt={AVATAR_LABEL[state]}
          fill
          sizes="160px"
          className="object-cover object-top"
          priority
        />
      </div>
      <span className="rounded-full bg-slate-900/80 px-3 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-500/30">
        {AVATAR_LABEL[state]}
      </span>
    </div>
  );
}
