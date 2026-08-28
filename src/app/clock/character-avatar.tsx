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

const AVATAR_MESSAGE: Record<AvatarState, string> = {
  HOME: "今日もよろしくお願いします!",
  WORK: "おつかれさまです!",
  NIGHT: "今日もおつかれさまでした!",
};

const AVATAR_DOT: Record<AvatarState, string> = {
  HOME: "bg-slate-400",
  WORK: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,.65)]",
  NIGHT: "bg-amber-500",
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
    <section className="relative h-[390px] overflow-hidden border-x border-white/10 bg-[#eadfd2] shadow-[0_12px_28px_rgba(65,35,24,.16)] sm:h-[410px]">
      <Image
        src={AVATAR_SRC[state]}
        alt={AVATAR_LABEL[state]}
        fill
        sizes="(max-width: 430px) 100vw, 430px"
        className={`object-cover ${state === "WORK" ? "object-[center_30%]" : "object-[center_22%]"}`}
        priority
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[37%] bg-gradient-to-t from-[#f9f4ed] via-[#f9f4ed]/78 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-transparent" />

      <div className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1.5 text-[12px] font-bold text-white shadow-lg backdrop-blur-md">
        {staffName} さん
      </div>

      <div className="absolute right-3 top-4 min-w-[138px] rounded-[18px] bg-white/95 px-4 py-3 text-center text-slate-800 shadow-[0_5px_18px_rgba(0,0,0,.16)] ring-1 ring-black/5 backdrop-blur-sm">
        <p className="flex items-center justify-center gap-2 text-[17px] font-black">
          <span className={`h-3 w-3 rounded-full ${AVATAR_DOT[state]}`} />
          <span className={state === "WORK" ? "text-emerald-600" : state === "NIGHT" ? "text-amber-600" : "text-slate-700"}>
            {AVATAR_LABEL[state]}
          </span>
        </p>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">{AVATAR_MESSAGE[state]}</p>
      </div>

      {children && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-1.5 px-4 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}
