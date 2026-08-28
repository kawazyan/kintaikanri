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

      {children && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-1.5 px-4 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}
