import Image from "next/image";
import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import type { AvatarState } from "@/lib/character-config";

export type { AvatarState };

const AVATAR_LABEL: Record<AvatarState, string> = {
  HOME: "未出勤",
  WORK: "勤務中",
  NIGHT: "勤務完了",
};

export function CharacterAvatar({
  state,
  imageSrc,
  staffName,
  children,
}: {
  state: AvatarState;
  imageSrc: string | null;
  staffName: string;
  children?: ReactNode;
}) {
  return (
    <section id="punch" className={`app-character-hero app-character-hero--${state.toLowerCase()}`}>
      {imageSrc && (
        <Image
          src={imageSrc}
          alt={AVATAR_LABEL[state]}
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          unoptimized={imageSrc.startsWith("data:")}
          className={`app-character-hero__image ${state === "WORK" ? "object-[center_30%]" : "object-[center_22%]"}`}
          priority
        />
      )}
      <div className="app-character-hero__shade" />
      <div className="app-character-hero__top">
        <div>
          <p className="app-character-hero__name">{staffName}</p>
          <p className="app-character-hero__sub"><MapPin size={11} /> K.J STAFF</p>
        </div>
        <span className="app-character-hero__status">{AVATAR_LABEL[state]}</span>
      </div>
      {children && <div className="app-character-hero__controls">{children}</div>}
    </section>
  );
}
