import Image from "next/image";
import type { ReactNode } from "react";

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

export function CharacterAvatar({
  state,
  staffName,
  children,
}: {
  state: AvatarState;
  staffName: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative -mx-4 h-[32rem] overflow-hidden">
      <Image
        src={AVATAR_SRC[state]}
        alt={AVATAR_LABEL[state]}
        fill
        sizes="100vw"
        className="object-cover object-top"
        priority
      />
      {/* Darkens the lower portion so the overlaid UI stays legible against
          the character art, fading out toward the top so the face is clear. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070f] from-15% via-[#05070f]/80 via-55% to-transparent" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <span className="rounded-full bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-200 shadow-md shadow-black/30 backdrop-blur-sm">
          {staffName} さん
        </span>
        <span className="rounded-full bg-slate-950/60 px-3 py-1 text-xs font-medium text-blue-300 shadow-md shadow-black/30 backdrop-blur-sm">
          {AVATAR_LABEL[state]}
        </span>
      </div>

      {children && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 pb-5">{children}</div>
      )}
    </div>
  );
}
