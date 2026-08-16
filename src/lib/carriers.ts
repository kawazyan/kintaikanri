export const CARRIERS = [
  "SoftBank・Y!mobile",
  "au・UQ",
  "docomo・ahamo",
  "楽天モバイル",
  "その他",
] as const;

export const CARRIER_OTHER = "その他";

export const WORK_TYPE_LABEL: Record<"BAND" | "SPOT", string> = {
  BAND: "帯稼働",
  SPOT: "スポット稼働",
};

// Whether a stored carrier value is one of the fixed presets (vs. a
// free-text value entered when the staff picked "その他").
export function isPresetCarrier(value: string): boolean {
  return (CARRIERS as readonly string[]).includes(value) && value !== CARRIER_OTHER;
}
