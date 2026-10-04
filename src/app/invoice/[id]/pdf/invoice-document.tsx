import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet } from "@react-pdf/renderer";
import { INVOICE_REGISTRATION_NUMBER } from "@/lib/invoice-defaults";

// 日本語表示には実フォントの登録が必須(react-pdf は既定でCJKグリフを持たない)。
Font.register({
  family: "NotoSerifJP",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSerifJP-Variable.ttf"),
});

const LETTERHEAD_IMAGE_PATH = path.join(process.cwd(), "src/assets/invoice/letterhead.png");
const BLUE = "#dbe5f1";
const LINE = "#7f7f7f";
const MIN_ROWS = 15;

export type InvoiceDocData = {
  addressee: string;
  subject: string;
  issuedAtLabel: string; // 例 2026/10/04。下書きは空文字
  lines: { label: string; description: string | null; quantity: number; unitPriceExTax: number }[];
  subtotalExTax: number;
  taxAmount: number;
  totalInclTax: number;
  note: string;
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const s = StyleSheet.create({
  page: { fontFamily: "NotoSerifJP", fontSize: 9, color: "#111", padding: 30 },
  titleWrap: { borderBottomWidth: 1, borderBottomColor: "#111", paddingBottom: 3 },
  title: { fontSize: 20, textAlign: "center", letterSpacing: 8 },
  top: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  topLeft: { width: "50%", paddingTop: 16 },
  addressee: { fontSize: 13, borderBottomWidth: 1, borderBottomColor: "#555", paddingBottom: 3 },
  intro: { marginTop: 14, fontSize: 8.5 },
  letterhead: { width: 190, height: 118 },
  subjectRow: { flexDirection: "row", marginTop: 12, borderBottomWidth: 1, borderBottomColor: "#2f5597", paddingBottom: 2, width: "56%" },
  subjectLabel: { width: 40, fontSize: 8.5 },
  meta: { alignItems: "flex-end", marginTop: -6 },
  issued: { fontSize: 8.5, textAlign: "right" },
  reg: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#111", paddingTop: 2, fontSize: 8.5, textAlign: "right", width: 190 },
  amountRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10, width: "56%", borderBottomWidth: 1, borderBottomColor: "#2f5597", paddingBottom: 2 },
  amountLabel: { fontSize: 11 },
  amountValue: { fontSize: 15 },
  tableHead: { flexDirection: "row", backgroundColor: BLUE, marginTop: 14, borderWidth: 1, borderColor: LINE },
  row: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: LINE, minHeight: 15 },
  cell: { paddingHorizontal: 4, paddingVertical: 2.5, borderRightWidth: 1, borderRightColor: LINE },
  cNo: { width: "8%", textAlign: "center" },
  cName: { width: "44%" },
  cQty: { width: "10%", textAlign: "center" },
  cPrice: { width: "15%", textAlign: "right" },
  cRate: { width: "8%", textAlign: "center" },
  cAmt: { width: "15%", textAlign: "right", borderRightWidth: 0 },
  sub: { fontSize: 7.5, color: "#444", marginTop: 1 },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  taxTable: { width: "46%" },
  taxHead: { flexDirection: "row" },
  taxRow: { flexDirection: "row", marginTop: 3 },
  tCol1: { width: "34%", fontSize: 8.5 },
  tCol2: { width: "33%", textAlign: "right", fontSize: 8.5 },
  tCol3: { width: "33%", textAlign: "right", fontSize: 8.5 },
  totals: { width: "40%" },
  totalRow: { flexDirection: "row", marginTop: 2, alignItems: "center" },
  totalLabel: { width: "50%", textAlign: "right", paddingRight: 8, fontSize: 8.5 },
  totalValue: { width: "50%", borderWidth: 1, borderColor: LINE, textAlign: "right", paddingHorizontal: 5, paddingVertical: 3 },
  noteBox: { marginTop: 10, borderWidth: 1, borderColor: LINE },
  noteHead: { backgroundColor: BLUE, textAlign: "center", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  noteBody: { padding: 8, lineHeight: 1.5, minHeight: 70 },
});

export function InvoiceDocument({ data }: { data: InvoiceDocData }) {
  const rowCount = Math.max(MIN_ROWS, data.lines.length);
  const rows = Array.from({ length: rowCount }, (_, i) => data.lines[i] ?? null);
  return (
    <Document title={`請求書 ${data.addressee} ${data.subject}`}>
      <Page size="A4" style={s.page}>
        <View style={s.titleWrap}>
          <Text style={s.title}>請求書</Text>
        </View>

        <View style={s.top}>
          <View style={s.topLeft}>
            <Text style={s.addressee}>{data.addressee}　御中</Text>
            <Text style={s.intro}>下記の通りご請求申し上げます。</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LETTERHEAD_IMAGE_PATH} style={s.letterhead} />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: "56%" }}>
            <View style={[s.subjectRow, { width: "100%" }]}>
              <Text style={s.subjectLabel}>件名：</Text>
              <Text style={{ flex: 1, fontSize: 9 }}>{data.subject}</Text>
            </View>
          </View>
          <View style={s.meta}>
            <Text style={s.issued}>発行日:　{data.issuedAtLabel || "（承認日が入ります）"}</Text>
            <Text style={s.reg}>登録番号 {INVOICE_REGISTRATION_NUMBER}</Text>
          </View>
        </View>

        <View style={s.amountRow}>
          <Text style={s.amountLabel}>ご請求金額（税込）</Text>
          <Text style={s.amountValue}>{yen(data.totalInclTax)}</Text>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.cell, s.cNo]}>NO.</Text>
          <Text style={[s.cell, s.cName, { textAlign: "center" }]}>品 番 ・ 品 名</Text>
          <Text style={[s.cell, s.cQty]}>数 量</Text>
          <Text style={[s.cell, s.cPrice, { textAlign: "center" }]}>単 価</Text>
          <Text style={[s.cell, s.cRate]}>税 率</Text>
          <Text style={[s.cell, s.cAmt, { textAlign: "center" }]}>金 額</Text>
        </View>
        {rows.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={[s.cell, s.cNo]}>{l ? i + 1 : ""}</Text>
            <View style={[s.cell, s.cName]}>
              {l && <Text>{l.label}</Text>}
              {l?.description ? <Text style={s.sub}>{l.description}</Text> : null}
            </View>
            <Text style={[s.cell, s.cQty]}>{l ? l.quantity : ""}</Text>
            <Text style={[s.cell, s.cPrice]}>{l ? yen(l.unitPriceExTax) : ""}</Text>
            <Text style={[s.cell, s.cRate]}>{l ? "10%" : ""}</Text>
            <Text style={[s.cell, s.cAmt]}>{l ? yen(l.quantity * l.unitPriceExTax) : ""}</Text>
          </View>
        ))}

        <View style={s.bottom} wrap={false}>
          <View style={s.taxTable}>
            <View style={s.taxHead}>
              <Text style={s.tCol1}>税率内訳</Text>
              <Text style={[s.tCol2, { textAlign: "center" }]}>税抜金額</Text>
              <Text style={[s.tCol3, { textAlign: "center" }]}>消費税額</Text>
            </View>
            <View style={s.taxRow}>
              <Text style={s.tCol1}>10%対象</Text>
              <Text style={s.tCol2}>{yen(data.subtotalExTax)}</Text>
              <Text style={s.tCol3}>{yen(data.taxAmount)}</Text>
            </View>
            <View style={s.taxRow}>
              <Text style={s.tCol1}>軽減8%対象</Text>
              <Text style={s.tCol2}>{yen(0)}</Text>
              <Text style={s.tCol3}>{yen(0)}</Text>
            </View>
            <View style={s.taxRow}>
              <Text style={s.tCol1}>非課税</Text>
              <Text style={s.tCol2}>{yen(0)}</Text>
              <Text style={s.tCol3}>{yen(0)}</Text>
            </View>
          </View>
          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>小計</Text>
              <Text style={s.totalValue}>{yen(data.subtotalExTax)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>消費税</Text>
              <Text style={s.totalValue}>{yen(data.taxAmount)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>合計金額</Text>
              <Text style={s.totalValue}>{yen(data.totalInclTax)}</Text>
            </View>
          </View>
        </View>

        <View style={s.noteBox} wrap={false}>
          <Text style={s.noteHead}>振込先情報・備 考</Text>
          <Text style={s.noteBody}>{data.note}</Text>
        </View>
      </Page>
    </Document>
  );
}
