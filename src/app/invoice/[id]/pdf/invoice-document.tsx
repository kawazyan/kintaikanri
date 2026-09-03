import path from "node:path";
import { Document, Page, Text, View, Image, Font, StyleSheet } from "@react-pdf/renderer";

// 明朝体(Noto Serif JP, SIL Open Font License)を登録する。日本語を正しく
// 表示するには実フォントの登録が必須(react-pdf は既定でCJKグリフを持たない)。
Font.register({
  family: "NotoSerifJP",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSerifJP-Variable.ttf"),
});

// 差出人欄に入れる印影・レターヘッド画像。用意でき次第このパスに配置する。
const LETTERHEAD_IMAGE_PATH = path.join(process.cwd(), "src/assets/invoice/letterhead.png");

const K_J_INVOICE_REGISTRATION_NUMBER = "T8370001045322";

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSerifJP",
    fontSize: 10,
    color: "#1a1a1a",
    padding: 40,
  },
  title: {
    fontSize: 22,
    letterSpacing: 6,
    textAlign: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
  },
  clientBlock: {
    flexDirection: "column",
    gap: 4,
  },
  clientName: {
    fontSize: 15,
    borderBottomWidth: 1.5,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 4,
    minWidth: 220,
  },
  metaBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
  },
  senderBlock: {
    marginTop: 14,
    alignItems: "flex-end",
  },
  letterheadImage: {
    width: 190,
  },
  registrationNumber: {
    marginTop: 4,
    fontSize: 8.5,
    color: "#444",
  },
  amountBox: {
    marginTop: 24,
    backgroundColor: "#f2f2f2",
    padding: 14,
  },
  amountLabel: {
    fontSize: 9,
    color: "#444",
  },
  amountValue: {
    fontSize: 22,
    marginTop: 2,
  },
  table: {
    marginTop: 22,
  },
  tableHeadRow: {
    flexDirection: "row",
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "#1a1a1a",
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#999",
    paddingVertical: 8,
  },
  colLabel: { flex: 2.4 },
  colNum: { flex: 1, textAlign: "right" },
  totalsBlock: {
    marginTop: 16,
    marginLeft: "auto",
    width: 220,
    flexDirection: "column",
    gap: 5,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1.5,
    borderColor: "#1a1a1a",
    paddingTop: 5,
    fontSize: 12,
  },
  footerBlock: {
    marginTop: 32,
    flexDirection: "row",
    gap: 28,
  },
  footerColumn: {
    flex: 1,
    flexDirection: "column",
    gap: 3,
  },
  footerHeading: {
    fontSize: 10.5,
    marginBottom: 2,
  },
  footerText: {
    fontSize: 9,
    color: "#333",
    lineHeight: 1.6,
  },
});

export type InvoicePdfLine = {
  id: string;
  label: string;
  unitPriceExTax: number;
  taxAmount: number;
  totalInclTax: number;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  yearMonth: string;
  clientName: string;
  issuedAtLabel: string;
  subtotalExTax: number;
  taxAmount: number;
  totalInclTax: number;
  lines: InvoicePdfLine[];
  hasLetterheadImage: boolean;
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

export function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>請 求 書</Text>

        <View style={styles.headerRow}>
          <View style={styles.clientBlock}>
            <Text style={styles.clientName}>{data.clientName} 御中</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text>請求書番号　{data.invoiceNumber}</Text>
            <Text>発行日　{data.issuedAtLabel}</Text>
            <Text>対象月　{data.yearMonth}</Text>
          </View>
        </View>

        <View style={styles.senderBlock}>
          {data.hasLetterheadImage && (
            /* eslint-disable-next-line jsx-a11y/alt-text */
            <Image style={styles.letterheadImage} src={LETTERHEAD_IMAGE_PATH} />
          )}
          <Text style={styles.registrationNumber}>登録番号　{K_J_INVOICE_REGISTRATION_NUMBER}</Text>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>ご請求金額（税込）</Text>
          <Text style={styles.amountValue}>{yen(data.totalInclTax)}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={styles.colLabel}>項目</Text>
            <Text style={styles.colNum}>単価（税抜）</Text>
            <Text style={styles.colNum}>税分</Text>
            <Text style={styles.colNum}>税込合計</Text>
          </View>
          {data.lines.map((l) => (
            <View key={l.id} style={styles.tableRow}>
              <Text style={styles.colLabel}>{l.label}</Text>
              <Text style={styles.colNum}>{yen(l.unitPriceExTax)}</Text>
              <Text style={styles.colNum}>{yen(l.taxAmount)}</Text>
              <Text style={styles.colNum}>{yen(l.totalInclTax)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>税抜合計</Text>
            <Text>{yen(data.subtotalExTax)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>税額</Text>
            <Text>{yen(data.taxAmount)}</Text>
          </View>
          <View style={styles.totalsFinalRow}>
            <Text>税込合計</Text>
            <Text>{yen(data.totalInclTax)}</Text>
          </View>
        </View>

        <View style={styles.footerBlock}>
          <View style={styles.footerColumn}>
            <Text style={styles.footerHeading}>お支払い期限</Text>
            <Text style={styles.footerText}>当請求書発行日の翌月末日までにお願い致します。</Text>
          </View>
          <View style={styles.footerColumn}>
            <Text style={styles.footerHeading}>振込先</Text>
            <Text style={styles.footerText}>
              paypay銀行　ビジネス営業所　3596034{"\n"}カ）ケイジェイ
            </Text>
            <Text style={styles.footerText}>※お振込み手数料は御社ご負担にてお願いいたします。</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
