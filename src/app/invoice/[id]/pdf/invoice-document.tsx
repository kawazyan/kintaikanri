import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet } from "@react-pdf/renderer";
import { INVOICE_BANK, INVOICE_REGISTRATION_NUMBER } from "@/lib/invoice-defaults";

// 日本語表示には実フォントの登録が必須(react-pdf は既定でCJKグリフを持たない)。
Font.register({
  family: "NotoSerifJP",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSerifJP-Variable.ttf"),
});

const LETTERHEAD_IMAGE_PATH = path.join(process.cwd(), "src/assets/invoice/letterhead.png");
const NAVY = "#1f3a68";
const INK = "#1a1a1a";
const MUTED = "#6b7280";
const HAIR = "#d4d8df";

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
  page: { fontFamily: "NotoSerifJP", fontSize: 9.5, color: INK, paddingHorizontal: 44, paddingTop: 42, paddingBottom: 36 },
  title: { fontSize: 26, letterSpacing: 12, color: NAVY, textAlign: "center" },
  titleRule: { marginTop: 8, height: 2, backgroundColor: NAVY },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 26 },
  left: { width: "55%" },
  addressee: { fontSize: 15, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: INK },
  subjectLabel: { marginTop: 16, fontSize: 8, color: MUTED },
  subject: { marginTop: 2, fontSize: 10.5 },
  intro: { marginTop: 14, fontSize: 9, color: MUTED },
  letterhead: { width: 170, height: 106 },
  band: { marginTop: 24, backgroundColor: NAVY, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bandLabel: { color: "#fff", fontSize: 11, letterSpacing: 2 },
  bandValue: { color: "#fff", fontSize: 22 },
  meta: { flexDirection: "row", marginTop: 14, borderBottomWidth: 0.8, borderBottomColor: HAIR, paddingBottom: 10 },
  metaCol: { width: "33.33%" },
  metaLabel: { fontSize: 8, color: MUTED },
  metaValue: { marginTop: 2, fontSize: 10 },
  tHead: { flexDirection: "row", marginTop: 26, paddingBottom: 6, borderBottomWidth: 1.2, borderBottomColor: NAVY },
  th: { fontSize: 8.5, color: NAVY, letterSpacing: 1 },
  row: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 0.8, borderBottomColor: HAIR },
  cName: { width: "44%" },
  cQty: { width: "10%", textAlign: "center" },
  cPrice: { width: "18%", textAlign: "right" },
  cRate: { width: "10%", textAlign: "center" },
  cAmt: { width: "18%", textAlign: "right" },
  sub: { fontSize: 8, color: MUTED, marginTop: 2 },
  sumWrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 18 },
  taxNote: { width: "48%", fontSize: 8.5, color: MUTED, lineHeight: 1.6 },
  sums: { width: "44%" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 0.8, borderBottomColor: HAIR },
  sumTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderTopWidth: 1.5, borderTopColor: NAVY, marginTop: 2 },
  noteWrap: { marginTop: 34 },
  noteHead: { fontSize: 9, color: NAVY, letterSpacing: 2, paddingBottom: 4, borderBottomWidth: 1.2, borderBottomColor: NAVY },
  noteBody: { marginTop: 12, paddingHorizontal: 2, lineHeight: 1.7, fontSize: 9.5 },
  bankBox: { marginTop: 10, borderWidth: 0.8, borderColor: HAIR },
  bankRow: { flexDirection: "row" },
  bankCell: { width: "50%", flexDirection: "row" },
  bankLabel: { width: 66, backgroundColor: "#f3f5f9", paddingVertical: 5, paddingHorizontal: 8, fontSize: 8.5, color: NAVY },
  bankValue: { flex: 1, paddingVertical: 5, paddingHorizontal: 8, fontSize: 10 },
});

export function InvoiceDocument({ data }: { data: InvoiceDocData }) {
  // 以前の請求の備考には「振込先：…」「お支払い期限：…」の行が入っている。振込先は表で出し、お支払い期限は
  // 上の欄に出るので、この2行は取り除く。代わりに「請求内訳書は別途添付」の1文を入れる(すでにあれば入れない)。
  const kept = data.note.split(/\r?\n/).filter((l) => !/^\s*(振込先|お支払い期限)[：:]/.test(l));
  const withAttach = [...kept];
  if (!kept.some((l) => l.includes("請求内訳書"))) {
    const at = kept.findIndex((l) => l.trim().startsWith("※"));
    withAttach.splice(at >= 0 ? at : kept.length, 0, "請求内訳書は別途添付いたします。");
  }
  const noteText = withAttach.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return (
    <Document title={`請求書 ${data.addressee} ${data.subject}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>請求書</Text>
        <View style={s.titleRule} />

        <View style={s.top}>
          <View style={s.left}>
            <Text style={s.addressee}>{data.addressee}　御中</Text>
            <Text style={s.subjectLabel}>件名</Text>
            <Text style={s.subject}>{data.subject}</Text>
            <Text style={s.intro}>下記の通りご請求申し上げます。</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LETTERHEAD_IMAGE_PATH} style={s.letterhead} />
        </View>

        <View style={s.band}>
          <Text style={s.bandLabel}>ご請求金額（税込）</Text>
          <Text style={s.bandValue}>{yen(data.totalInclTax)}</Text>
        </View>

        <View style={s.meta}>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>発行日</Text>
            <Text style={s.metaValue}>{data.issuedAtLabel}</Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>お支払期限</Text>
            <Text style={s.metaValue}>{data.dueLabel ?? "―"}</Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>適格請求書発行事業者登録番号</Text>
            <Text style={s.metaValue}>{INVOICE_REGISTRATION_NUMBER}</Text>
          </View>
        </View>

        <View style={s.tHead}>
          <Text style={[s.th, s.cName]}>品名</Text>
          <Text style={[s.th, s.cQty]}>数量</Text>
          <Text style={[s.th, s.cPrice]}>単価（税抜）</Text>
          <Text style={[s.th, s.cRate]}>税率</Text>
          <Text style={[s.th, s.cAmt]}>金額（税抜）</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <View style={s.cName}>
              <Text>{l.label}</Text>
              {l.description ? <Text style={s.sub}>{l.description}</Text> : null}
            </View>
            <Text style={s.cQty}>{l.quantity}</Text>
            <Text style={s.cPrice}>{yen(l.unitPriceExTax)}</Text>
            <Text style={s.cRate}>10%</Text>
            <Text style={s.cAmt}>{yen(l.quantity * l.unitPriceExTax)}</Text>
          </View>
        ))}

        <View style={s.sumWrap} wrap={false}>
          <Text style={s.taxNote}>
            税率内訳{"\n"}10%対象　{yen(data.subtotalExTax)}（消費税 {yen(data.taxAmount)}）
          </Text>
          <View style={s.sums}>
            <View style={s.sumRow}>
              <Text>小計</Text>
              <Text>{yen(data.subtotalExTax)}</Text>
            </View>
            <View style={s.sumRow}>
              <Text>消費税（10%）</Text>
              <Text>{yen(data.taxAmount)}</Text>
            </View>
            <View style={s.sumTotal}>
              <Text style={{ color: NAVY, fontSize: 10.5 }}>合計（税込）</Text>
              <Text style={{ fontSize: 14 }}>{yen(data.totalInclTax)}</Text>
            </View>
          </View>
        </View>

        <View style={s.noteWrap} wrap={false}>
          <Text style={s.noteHead}>振込先情報・備考</Text>
          <View style={s.bankBox}>
            <View style={s.bankRow}>
              <View style={s.bankCell}><Text style={s.bankLabel}>金融機関</Text><Text style={s.bankValue}>{INVOICE_BANK.bank}</Text></View>
              <View style={s.bankCell}><Text style={s.bankLabel}>支店名</Text><Text style={s.bankValue}>{INVOICE_BANK.branch}</Text></View>
            </View>
            <View style={[s.bankRow, { borderTopWidth: 0.8, borderTopColor: HAIR }]}>
              <View style={s.bankCell}><Text style={s.bankLabel}>預金種別</Text><Text style={s.bankValue}>{INVOICE_BANK.accountType}</Text></View>
              <View style={s.bankCell}><Text style={s.bankLabel}>口座番号</Text><Text style={s.bankValue}>{INVOICE_BANK.accountNumber}</Text></View>
            </View>
            <View style={[s.bankRow, { borderTopWidth: 0.8, borderTopColor: HAIR }]}>
              <View style={[s.bankCell, { width: "100%" }]}><Text style={s.bankLabel}>口座名義</Text><Text style={s.bankValue}>{INVOICE_BANK.accountHolder}</Text></View>
            </View>
          </View>
          <Text style={s.noteBody}>{noteText}</Text>
        </View>
      </Page>
    </Document>
  );
}
