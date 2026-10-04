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

// "2026-10-03" → "10/3(土)"。曜日は日付から計算する(UTC基準で日付のみ扱う)。
function formatDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEKDAYS[wd]})`;
}

export type StatementTotals = { subtotalExTax: number; taxAmount: number; totalInclTax: number };

// 請求書は「業務委託費一式」の1行のみ。その内訳(計算方法)はすべてここに書く。
type Item = { label: string; calc: string; amountExTax: number };
function staffItems(s: StatementStaff): Item[] {
  const items: Item[] = [{ label: "業務委託費", calc: s.serviceCalc || "―", amountExTax: s.serviceExTax ?? 0 }];
  if (s.travel.mode !== "NONE") {
    items.push({
      label: travelLineLabel(s.travel.amountInclTax),
      calc: `${yen(s.travel.amountExTax)}＋税で計算${s.travel.mode === "FLAT" ? "（月額一律）" : ""}`,
      amountExTax: s.travel.amountExTax,
    });
  }
  for (const e of s.extras ?? []) {
    items.push({ label: e.label, calc: `${yen(e.amountExTax)}＋税で計算`, amountExTax: e.amountExTax });
  }
  return items;
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
  staffHead: { flexDirection: "row", justifyContent: "space-between", backgroundColor: BLUE, paddingVertical: 5, paddingHorizontal: 8 },
  staffName: { fontSize: 11 },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d0d0d0" },
  label: { width: 84, paddingVertical: 3, paddingHorizontal: 6, backgroundColor: "#f7f7f7", fontSize: 8.5, color: "#444" },
  value: { flex: 1, paddingVertical: 3, paddingHorizontal: 6, lineHeight: 1.1 },
  itemHead: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, backgroundColor: "#f2f2f2" },
  itemRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d0d0d0" },
  cItem: { width: "30%", paddingVertical: 3.5, paddingHorizontal: 6 },
  cCalc: { width: "48%", paddingVertical: 3.5, paddingHorizontal: 6, lineHeight: 1.1 },
  cAmt: { width: "22%", paddingVertical: 3.5, paddingHorizontal: 6, textAlign: "right" },
  small: { fontSize: 8.5, color: "#444" },
  summary: { marginTop: 18, borderWidth: 1, borderColor: NAVY },
  summaryHead: { backgroundColor: NAVY, color: "#fff", textAlign: "center", paddingVertical: 4, fontSize: 10, letterSpacing: 3 },
  sRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: "#d0d0d0" },
  sTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1.5, borderTopColor: NAVY, backgroundColor: "#eef3fa" },
  note: { marginTop: 10, fontSize: 8, color: "#555", lineHeight: 1.5 },
});

export function StatementDocument({ data, totals }: { data: StatementSnapshot; totals: StatementTotals }) {
  const [y, m] = data.yearMonth.split("-").map(Number);
  return (
    <Document title={`稼働明細書 ${data.clientName} ${data.yearMonth}`}>
      <Page size="A4" style={st.page}>
        <View style={st.titleWrap}>
          <Text style={st.title}>稼働明細書</Text>
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
              <Text style={st.small}>小計（税抜）　{yen(staffBillableExTax(s))}</Text>
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
              <Text style={st.label}>出勤した日</Text>
              <Text style={st.value}>{s.dates.map(formatDay).join("　") || "―"}</Text>
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
          </View>
        ))}

        <View style={st.summary} wrap={false}>
          <Text style={st.summaryHead}>ご請求金額のまとめ</Text>
          {data.staff.map((s, i) => (
            <View key={i} style={st.sRow}>
              <Text>{s.name}　（業務委託費{s.travel.mode !== "NONE" ? "・交通費相当額" : ""}{(s.extras ?? []).length ? "・その他" : ""}）</Text>
              <Text>{yen(staffBillableExTax(s))}</Text>
            </View>
          ))}
          <View style={st.sRow}>
            <Text>小計（税抜）＝ 業務委託費一式</Text>
            <Text>{yen(totals.subtotalExTax)}</Text>
          </View>
          <View style={st.sRow}>
            <Text>消費税（10%）</Text>
            <Text>{yen(totals.taxAmount)}</Text>
          </View>
          <View style={st.sTotal}>
            <Text style={{ fontSize: 11 }}>ご請求金額（税込）</Text>
            <Text style={{ fontSize: 15 }}>{yen(totals.totalInclTax)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
