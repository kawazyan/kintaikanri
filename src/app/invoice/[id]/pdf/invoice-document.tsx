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
const NAVY = "#2f5597";
const LINE = "#7f7f7f";
const MIN_ROWS = 7;

export type InvoiceDocData = {
  addressee: string;
  subject: string;
  issuedAtLabel: string; // 例 2026/10/04
  dueLabel?: string; // お支払期限 例 2026/10/31
  lines: { label: string; description: string | null; quantity: number; unitPriceExTax: number }[];
  subtotalExTax: number;
  taxAmount: number;
  totalInclTax: number;
  note: string;
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

const s = StyleSheet.create({
  page: { fontFamily: "NotoSerifJP", fontSize: 9.5, color: "#111", paddingHorizontal: 40, paddingVertical: 36 },
  titleWrap: { borderBottomWidth: 1.2, borderBottomColor: "#111", paddingBottom: 4 },
  title: { fontSize: 22, textAlign: "center", letterSpacing: 10 },
  top: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  left: { width: "54%" },
  right: { width: "40%", alignItems: "flex-end" },
  addressee: { fontSize: 14, borderBottomWidth: 1.2, borderBottomColor: "#111", paddingBottom: 4 },
  intro: { marginTop: 8, fontSize: 9 },
  subjectRow: { flexDirection: "row", marginTop: 14 },
  subjectLabel: { width: 36, fontSize: 9, color: "#444" },
  subjectText: { flex: 1, fontSize: 10 },
  amountBox: { marginTop: 14, borderWidth: 1.5, borderColor: NAVY, backgroundColor: "#eef3fa", paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amountLabel: { fontSize: 10.5 },
  amountValue: { fontSize: 20 },
  letterhead: { width: 175, height: 109 },
  meta: { marginTop: 10, width: 175 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, borderBottomWidth: 0.7, borderBottomColor: "#aaa", fontSize: 8.5 },
  tableHead: { flexDirection: "row", backgroundColor: BLUE, marginTop: 20, borderWidth: 1, borderColor: LINE },
  row: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: LINE, minHeight: 22 },
  cell: { paddingHorizontal: 5, paddingVertical: 4, borderRightWidth: 1, borderRightColor: LINE },
  cNo: { width: "8%", textAlign: "center" },
  cName: { width: "44%" },
  cQty: { width: "10%", textAlign: "center" },
  cPrice: { width: "15%", textAlign: "right" },
  cRate: { width: "8%", textAlign: "center" },
  cAmt: { width: "15%", textAlign: "right", borderRightWidth: 0 },
  sub: { fontSize: 7.5, color: "#444", marginTop: 1 },
  bottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  taxTable: { width: "50%", borderWidth: 1, borderColor: LINE },
  taxHead: { flexDirection: "row", backgroundColor: BLUE },
  taxRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  tCol1: { width: "34%", fontSize: 8.5, paddingVertical: 3.5, paddingHorizontal: 5 },
  tCol2: { width: "33%", textAlign: "right", fontSize: 8.5, paddingVertical: 3.5, paddingHorizontal: 5 },
  tCol3: { width: "33%", textAlign: "right", fontSize: 8.5, paddingVertical: 3.5, paddingHorizontal: 5 },
  totals: { width: "42%", borderWidth: 1, borderColor: LINE },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  totalLabel: { width: "45%", backgroundColor: BLUE, paddingVertical: 4.5, paddingHorizontal: 6, fontSize: 9 },
  totalValue: { width: "55%", textAlign: "right", paddingVertical: 4.5, paddingHorizontal: 6 },
  noteBox: { marginTop: 18, borderWidth: 1, borderColor: LINE },
  noteHead: { backgroundColor: BLUE, textAlign: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: LINE, letterSpacing: 2 },
  noteBody: { padding: 10, lineHeight: 1.6, minHeight: 90 },
});

export function InvoiceDocument({ data }: { data: InvoiceDocData }) {
  // 補足(description)があると行が高くなるので、その分だけ空行を減らして1ページに収める。
  const usedUnits = data.lines.reduce((sum, l) => sum + 1 + (l.description ? 1 : 0), 0);
  const emptyRows = Math.max(0, MIN_ROWS - usedUnits);
  const rows: (InvoiceDocData["lines"][number] | null)[] = [...data.lines, ...Array.from({ length: emptyRows }, () => null)];
  return (
    <Document title={`請求書 ${data.addressee} ${data.subject}`}>
      <Page size="A4" style={s.page}>
        <View style={s.titleWrap}>
          <Text style={s.title}>請求書</Text>
        </View>

        <View style={s.top}>
          <View style={s.left}>
            <Text style={s.addressee}>{data.addressee}　御中</Text>
            <Text style={s.intro}>下記の通りご請求申し上げます。</Text>
            <View style={s.subjectRow}>
              <Text style={s.subjectLabel}>件名：</Text>
              <Text style={s.subjectText}>{data.subject}</Text>
            </View>
            <View style={s.amountBox}>
              <Text style={s.amountLabel}>ご請求金額（税込）</Text>
              <Text style={s.amountValue}>{yen(data.totalInclTax)}</Text>
            </View>
          </View>
          <View style={s.right}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={LETTERHEAD_IMAGE_PATH} style={s.letterhead} />
            <View style={s.meta}>
              <View style={s.metaRow}>
                <Text>発行日</Text>
                <Text>{data.issuedAtLabel}</Text>
              </View>
              {data.dueLabel ? (
                <View style={s.metaRow}>
                  <Text>お支払期限</Text>
                  <Text>{data.dueLabel}</Text>
                </View>
              ) : null}
              <View style={s.metaRow}>
                <Text>登録番号</Text>
                <Text>{INVOICE_REGISTRATION_NUMBER}</Text>
              </View>
            </View>
          </View>
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
            <View style={[s.totalRow, { borderTopWidth: 0 }]}>
              <Text style={s.totalLabel}>小計</Text>
              <Text style={s.totalValue}>{yen(data.subtotalExTax)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>消費税（10%）</Text>
              <Text style={s.totalValue}>{yen(data.taxAmount)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { backgroundColor: NAVY, color: "#fff" }]}>合計金額</Text>
              <Text style={[s.totalValue, { fontSize: 11.5, backgroundColor: "#eef3fa" }]}>{yen(data.totalInclTax)}</Text>
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
