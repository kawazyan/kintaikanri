import type { LucideIcon } from "lucide-react";

export function MetalIcon({ icon: Icon, tone="silver", size=24 }: { icon: LucideIcon; tone?: "silver"|"gold"|"red"|"green"; size?: number }) {
  return <span className={`metal-icon metal-icon-${tone}`}><Icon size={size} strokeWidth={2.35}/></span>;
}
