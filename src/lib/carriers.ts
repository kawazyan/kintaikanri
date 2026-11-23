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

// 店舗名の先頭に付けるキャリア名(契約の「キャリア名を先頭に付ける」がONのとき)。
// 楽天モバイル以外は「〇〇ショップ」(au → auショップ / docomo → ドコモショップ / SoftBank → ソフトバンクショップ)、楽天モバイルは「楽天モバイル」。
// 「その他」や自由入力のキャリアは付けない(null)。
export function carrierStorePrefix(carrier: string): string | null {
  const c = carrier.trim();
  if (/^au/i.test(c)) return "auショップ";
  if (/^docomo/i.test(c)) return "ドコモショップ";
  if (/^softbank/i.test(c)) return "ソフトバンクショップ";
  if (c.startsWith("楽天モバイル")) return "楽天モバイル";
  return null;
}
