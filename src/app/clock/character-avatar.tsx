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

const AVATAR_DOT: Record<AvatarState, string> = {
  HOME: "bg-slate-400",
  WORK: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]",
  NIGHT: "bg-amber-400",
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
    <div className="relative h-[32rem] overflow-hidden">
      <Image
        src={AVATAR_SRC[state]}
        alt={AVATAR_LABEL[state]}
        fill
        sizes="100vw"
        className="object-cover object-top"
        priority
      />
      {/* Fades to white toward the bottom so the clock/buttons sit on a
          light backdrop (instead of a dark band that swallowed the time)
          and the photo blends straight into the white page content below
          with no hard edge. No gap, border, or shadow separates this from
          GamePanel above — that's what keeps that seam invisible. */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-white from-8% via-white/85 via-42% to-transparent" />

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
        <span className="rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-sm">
          {staffName} さん
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${AVATAR_DOT[state]}`} />
          {AVATAR_LABEL[state]}
        </span>
      </div>

      {children && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 pb-5">{children}</div>
      )}
    </div>
  );
}
