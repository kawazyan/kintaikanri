import path from "node:path";
import { Document, Page, Text, View, Font, StyleSheet } from "@react-pdf/renderer";
import { staffBillableExTax, type StatementSnapshot, type StatementStaff } from "@/lib/invoice-draft";
import { travelLineLabel } from "@/lib/billing";

Font.register({
  family: "NotoSerifJP",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSerifJP-Variable.ttf"),
});

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const NAVY = "#2f5597";
const BLUE = "#dbe5f1";
const LINE = "#9a9a9a";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export type StatementTotals = { subtotalExTax: number; taxAmount: number; totalInclTax: number };

// 請求書は「業務委託費一式」の1行のみ。その内訳(計算方法)はすべてここに書く。
type Item = { label: string; calc: string; amountExTax: number };
function staffItems(s: StatementStaff): Item[] {
  const items: Item[] = [{ label: "業務委託費", calc: s.serviceCalc || "―", amountExTax: s.serviceExTax ?? 0 }];
  if (s.travel.mode !== "NONE" && s.travel.lines?.length) {
    for (const l of s.travel.lines) items.push({ label: l.label, calc: l.calc, amountExTax: l.amountExTax });
  } else if (s.travel.mode !== "NONE") {
    items.push({
      label: travelLineLabel(s.travel.amountInclTax),
      calc: s.travel.calc || `${yen(s.travel.amountExTax)}＋税で計算${s.travel.mode === "FLAT" ? "（月額一律）" : ""}`,
      amountExTax: s.travel.amountExTax,
    });
  }
  for (const e of s.extras ?? []) {
    items.push({ label: e.label, calc: e.calc || `${yen(e.amountExTax)}＋税で計算`, amountExTax: e.amountExTax });
  }
  return items;
}

// 出勤日を、店舗ごとにまとめて日付(大)と曜日(小)の小さなカードで並べる。土曜は薄い青、日曜は薄い赤の地。
const UNKNOWN_PLACE = "稼働店舗 要確認";
function AttendanceDays({ yearMonth, staff }: { yearMonth: string; staff: StatementStaff }) {
  const m = Number(yearMonth.split("-")[1]);
  const placeOf = (d: string) => {
    const p = staff.dayPlaces?.[d]?.trim() || (staff.places.length === 1 ? staff.places[0]?.trim() : "");
    return p && p !== "未定" ? p : UNKNOWN_PLACE;
  };
  const groups = new Map<string, string[]>();
  for (const d of staff.dates) groups.set(placeOf(d), [...(groups.get(placeOf(d)) ?? []), d]);
  return (
    <View style={{ flex: 1, padding: 8 }}>
      <Text style={{ fontSize: 8.5, color: "#666", marginBottom: 4 }}>{m}月</Text>
      {[...groups].map(([place, ds]) => (
        <View key={place} style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 9, color: NAVY, marginBottom: 3 }}>{place}　{ds.length}日</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {ds.map((d) => {
              const [yy, mm, dd] = d.split("-").map(Number);
              const wd = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
              const color = wd === 0 ? "#b4545a" : wd === 6 ? "#4a6fa5" : "#1a1a1a";
              const bg = wd === 0 ? "#fbeeee" : wd === 6 ? "#eef3fb" : "#ffffff";
              return (
                <View key={d} style={{ width: "8.6%", marginRight: "0.4%", marginBottom: 4, alignItems: "center", borderWidth: 0.8, borderColor: "#c9d3e3", borderRadius: 4, paddingVertical: 2, backgroundColor: bg }}>
                  <Text style={{ fontSize: 11, color }}>{dd}</Text>
                  <Text style={{ fontSize: 6.5, color }}>{WEEKDAYS[wd]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
      {staff.dates.length === 0 && <Text>―</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  page: { fontFamily: "NotoSerifJP", fontSize: 9.5, color: "#1a1a1a", padding: 36 },
  titleWrap: { borderBottomWidth: 1, borderBottomColor: "#111", paddingBottom: 4 },
  title: { fontSize: 20, letterSpacing: 8, textAlign: "center" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18 },
  client: { fontSize: 14, borderBottomWidth: 1.2, borderBottomColor: "#111", paddingBottom: 3, minWidth: 250 },
  month: { fontSize: 11 },
  lead: { marginTop: 8, fontSize: 8.5, color: "#444" },
  staffBlock: { marginTop: 10, borderWidth: 1, borderColor: LINE },
  staffHead: { flexDirection: "row", justifyContent: "center", backgroundColor: BLUE, paddingVertical: 5, paddingHorizontal: 8 },
  staffName: { fontSize: 11 },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d0d0d0" },
  label: { width: 84, flexShrink: 0, paddingVertical: 3, paddingHorizontal: 6, backgroundColor: "#f7f7f7", fontSize: 8.5, color: "#444" },
  value: { flex: 1, paddingVertical: 3, paddingHorizontal: 6, lineHeight: 1.1 },
  itemHead: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, backgroundColor: "#f2f2f2" },
  itemRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d0d0d0" },
  cItem: { width: "30%", paddingVertical: 3.5, paddingHorizontal: 6 },
  cCalc: { width: "48%", paddingVertical: 3.5, paddingHorizontal: 6, lineHeight: 1.1 },
  subRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d0d0d0", backgroundColor: "#f7f7f7" },
  subLabel: { width: "78%", paddingVertical: 3.5, paddingHorizontal: 6, textAlign: "right", fontSize: 8.5, color: "#444" },
  cStore: { width: "42%", paddingVertical: 3.5, paddingHorizontal: 6 },
  cPeriod: { width: "36%", paddingVertical: 3.5, paddingHorizontal: 6 },
  cAmt: { width: "22%", paddingVertical: 3.5, paddingHorizontal: 6, textAlign: "right" },
  small: { fontSize: 8.5, color: "#444" },
  summary: { marginTop: 18, borderWidth: 1, borderColor: NAVY },
  summaryHead: { backgroundColor: NAVY, color: "#fff", textAlign: "center", paddingVertical: 4, fontSize: 10, letterSpacing: 3 },
  sRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: "#d0d0d0" },
  sTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, backgroundColor: NAVY },
  totalBox: { width: "52%", borderWidth: 1, borderColor: NAVY },
  note: { marginTop: 10, fontSize: 8, color: "#555", lineHeight: 1.5 },
});

// ご請求金額のまとめ: 全スタッフ・全項目を種類ごとに合計する(0円の種類は出さない)。
// 商材費 = 取引先全体の項目のうち、名前に「商材」を含むもの。その他 = 宿泊費など、どれにも当てはまらないもの。
function summaryRows(data: StatementSnapshot): { label: string; amountExTax: number }[] {
  const sum = (xs: { amountExTax: number }[]) => xs.reduce((a, e) => a + e.amountExTax, 0);
  const ce = data.clientExtras ?? [];
  const ads = ce.filter((e) => e.store && e.period);
  const rest = ce.filter((e) => !(e.store && e.period));
  const goods = rest.filter((e) => e.label.includes("商材"));
  const others = [...rest.filter((e) => !e.label.includes("商材")), ...data.staff.flatMap((s) => s.extras ?? [])];
  return [
    { label: "業務委託費", amountExTax: sum(data.staff.map((s) => ({ amountExTax: s.serviceExTax ?? 0 }))) },
    { label: "交通費相当額", amountExTax: sum(data.staff.map((s) => ({ amountExTax: s.travel.amountExTax }))) },
    { label: "広告掲載費", amountExTax: sum(ads) },
    { label: "商材費", amountExTax: sum(goods) },
    { label: "その他", amountExTax: sum(others) },
  ].filter((r) => r.amountExTax > 0 || r.label === "業務委託費");
}

export function StatementDocument({ data, totals }: { data: StatementSnapshot; totals: StatementTotals }) {
  const [y, m] = data.yearMonth.split("-").map(Number);
  return (
    <Document title={`請求内訳書 ${data.clientName} ${data.yearMonth}`}>
      <Page size="A4" style={st.page}>
        <View style={st.titleWrap}>
          <Text style={st.title}>請求内訳書</Text>
        </View>
        <View style={st.head}>
          <Text style={st.client}>{data.clientName}　御中</Text>
          <Text style={st.month}>{y}年{m}月稼働分</Text>
        </View>
        <Text style={st.lead}>請求書「業務委託費一式」の内訳です。金額は税抜、消費税は合計に対して10%で計算しています。</Text>

        {data.staff.length === 0 && <Text style={st.note}>対象月の稼働実績はありません。</Text>}

        {data.staff.map((s, i) => (
          <View key={`${s.name}-${i}`} style={st.staffBlock} wrap={false}>
            <View style={st.staffHead}>
              <Text style={st.staffName}>スタッフ名　{s.name}</Text>
            </View>
            <View style={st.row}>
              <Text style={st.label}>稼働場所</Text>
              <Text style={st.value}>{s.places.join("、") || "―"}</Text>
            </View>
            <View style={st.row}>
              <Text style={st.label}>キャリア</Text>
              <Text style={st.value}>{s.carriers.join("、") || "―"}</Text>
            </View>
            <View style={st.row}>
              <Text style={st.label}>出勤日</Text>
              <AttendanceDays yearMonth={data.yearMonth} staff={s} />
            </View>
            <View style={st.row}>
              <Text style={st.label}>合計稼働日数</Text>
              <Text style={st.value}>{s.days}日</Text>
            </View>
            <View style={st.itemHead}>
              <Text style={[st.cItem, st.small]}>項目</Text>
              <Text style={[st.cCalc, st.small]}>計算方法</Text>
              <Text style={[st.cAmt, st.small]}>金額（税抜）</Text>
            </View>
            {staffItems(s).map((it, k) => (
              <View key={k} style={st.itemRow}>
                <Text style={st.cItem}>{it.label}</Text>
                <Text style={st.cCalc}>{it.calc}</Text>
                <Text style={st.cAmt}>{yen(it.amountExTax)}</Text>
              </View>
            ))}
            <View style={st.subRow}>
              <Text style={st.subLabel}>小計（税抜）</Text>
              <Text style={st.cAmt}>{yen(staffBillableExTax(s))}</Text>
            </View>
          </View>
        ))}

        {(data.clientExtras ?? []).length > 0 && (
          <View style={st.staffBlock} wrap={false}>
            <View style={st.staffHead}>
              <Text style={st.staffName}>広告費</Text>
            </View>
            {(data.clientExtras ?? []).some((e) => e.store && e.period) && (
              <View>
                <View style={st.itemHead}>
                  <Text style={[st.cStore, st.small]}>イベント主催店舗</Text>
                  <Text style={[st.cPeriod, st.small]}>イベント開催期間</Text>
                  <Text style={[st.cAmt, st.small]}>金額（税抜）</Text>
                </View>
                {(data.clientExtras ?? []).filter((e) => e.store && e.period).map((e, k) => (
                  <View key={k} style={st.itemRow}>
                    <Text style={st.cStore}>{e.store}</Text>
                    <Text style={st.cPeriod}>{e.period}</Text>
                    <Text style={st.cAmt}>{yen(e.amountExTax)}</Text>
                  </View>
                ))}
              </View>
            )}
            {(data.clientExtras ?? []).some((e) => !(e.store && e.period)) && (
              <View>
                <View style={st.itemHead}>
                  <Text style={[st.cItem, st.small]}>項目</Text>
                  <Text style={[st.cCalc, st.small]}>計算方法</Text>
                  <Text style={[st.cAmt, st.small]}>金額（税抜）</Text>
                </View>
                {(data.clientExtras ?? []).filter((e) => !(e.store && e.period)).map((e, k) => (
                  <View key={k} style={st.itemRow}>
                    <Text style={st.cItem}>{e.label}</Text>
                    <Text style={st.cCalc}>{e.calc || `${yen(e.amountExTax)}＋税で計算`}</Text>
                    <Text style={st.cAmt}>{yen(e.amountExTax)}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={st.subRow}>
              <Text style={st.subLabel}>小計（税抜）</Text>
              <Text style={st.cAmt}>{yen((data.clientExtras ?? []).reduce((a, e) => a + e.amountExTax, 0))}</Text>
            </View>
          </View>
        )}

        <View wrap={false}>
        <View style={st.summary}>
          <Text style={st.summaryHead}>ご請求金額のまとめ</Text>
          {summaryRows(data).map((r, i) => (
            <View key={i} style={st.sRow}>
              <Text>{r.label}</Text>
              <Text>{yen(r.amountExTax)}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
          <View style={st.totalBox}>
            <View style={[st.sRow, { borderTopWidth: 0 }]}>
              <Text>小計（税抜）</Text>
              <Text>{yen(totals.subtotalExTax)}</Text>
            </View>
            <View style={st.sRow}>
              <Text>消費税（10%）</Text>
              <Text>{yen(totals.taxAmount)}</Text>
            </View>
            <View style={st.sTotal}>
              <Text style={{ fontSize: 10.5, color: "#fff" }}>ご請求金額（税込）</Text>
              <Text style={{ fontSize: 14, color: "#fff" }}>{yen(totals.totalInclTax)}</Text>
            </View>
          </View>
        </View>
        </View>
      </Page>
    </Document>
  );
}
