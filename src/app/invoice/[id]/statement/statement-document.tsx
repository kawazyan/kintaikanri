import path from "node:path";
import { Document, Page, Text, View, Font, StyleSheet } from "@react-pdf/renderer";
import type { StatementSnapshot } from "@/lib/invoice-draft";

Font.register({
  family: "NotoSerifJP",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSerifJP-Variable.ttf"),
});

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// "2026-10-03" → "10/3(土)"。曜日は日付から計算する(UTC基準で日付のみ扱う)。
function formatDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEKDAYS[wd]})`;
}

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSerifJP", fontSize: 10, color: "#1a1a1a", padding: 40 },
  title: { fontSize: 22, letterSpacing: 6, textAlign: "center" },
  client: { marginTop: 26, fontSize: 15, borderBottomWidth: 1.5, borderBottomColor: "#1a1a1a", paddingBottom: 4, alignSelf: "flex-start", minWidth: 240 },
  month: { marginTop: 10, fontSize: 12 },
  staffBlock: { marginTop: 18, borderWidth: 1, borderColor: "#999" },
  staffHead: { backgroundColor: "#f2f2f2", padding: 8, fontSize: 12 },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#ccc" },
  label: { width: 92, padding: 7, backgroundColor: "#fafafa", fontSize: 9, color: "#444" },
  value: { flex: 1, padding: 7, lineHeight: 1.5 },
  note: { marginTop: 18, fontSize: 8.5, color: "#555" },
});

export function StatementDocument({ data }: { data: StatementSnapshot }) {
  const [y, m] = data.yearMonth.split("-").map(Number);
  return (
    <Document title={`稼働明細書 ${data.clientName} ${data.yearMonth}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>稼働明細書</Text>
        <Text style={styles.client}>{data.clientName} 御中</Text>
        <Text style={styles.month}>{y}年{m}月稼働分</Text>

        {data.staff.length === 0 && <Text style={styles.note}>対象月の稼働実績はありません。</Text>}

        {data.staff.map((s, i) => (
          <View key={`${s.name}-${i}`} style={styles.staffBlock} wrap={false}>
            <Text style={styles.staffHead}>スタッフ名　{s.name}</Text>
            <View style={styles.row}>
              <Text style={styles.label}>稼働場所</Text>
              <Text style={styles.value}>{s.places.join("、") || "―"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>キャリア</Text>
              <Text style={styles.value}>{s.carriers.join("、") || "―"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>出勤した日</Text>
              <Text style={styles.value}>{s.dates.map(formatDay).join("　") || "―"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>合計稼働日数</Text>
              <Text style={styles.value}>{s.days}日</Text>
            </View>
            {s.travel.mode !== "NONE" && (
              <View style={styles.row}>
                <Text style={styles.label}>交通費</Text>
                <Text style={styles.value}>
                  ¥{s.travel.amountExTax.toLocaleString("ja-JP")}（税抜）{s.travel.mode === "FLAT" ? "　※月額一律" : ""}
                </Text>
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
