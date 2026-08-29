import type { LucideIcon } from "lucide-react";

export function HexIcon({
  icon: Icon,
  tone = "silver",
  size = 26,
  small = false,
}: {
  icon: LucideIcon;
  tone?: "silver" | "gold" | "red" | "blue" | "green";
  size?: number;
  small?: boolean;
}) {
  return (
    <span className={`hex-icon hex-icon--${tone}${small ? " hex-icon-sm" : ""}`}>
      <Icon size={size} strokeWidth={2.2} />
    </span>
  );
}
