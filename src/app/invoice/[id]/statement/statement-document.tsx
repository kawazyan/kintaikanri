import path from "node:path";
import { Document, Page, Text, View, Font, StyleSheet } from "@react-pdf/renderer";
import { staffBillableExTax, type StatementExtra, type StatementSnapshot, type StatementStaff } from "@/lib/invoice-draft";
import { travelLineLabel } from "@/lib/billing";
import { softWrap } from "@/lib/soft-wrap";

Font.register({
  family: "NotoSerifJP",
  src: path.join(process.cwd(), "src/assets/fonts/NotoSerifJP-Variable.ttf"),
});

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const NAVY = "#2f5597";
const BLUE = "#dbe5f1";
const LINE = "#9a9a9a";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

// 「項目」の列(幅30%)に収まる文字数の目安(全角換算)。これを超える項目名は自動で改行する(隣の列に重ならないように)。
const ITEM_COL_EM = 14;

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
          {(groups.size > 1 || place === UNKNOWN_PLACE) && <Text style={{ fontSize: 9, color: NAVY, marginBottom: 3 }}>{place}　{ds.length}日</Text>}
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


function StaffBlock({ yearMonth, s, showItems }: { yearMonth: string; s: StatementStaff; showItems: boolean }) {
  return (
          <View style={st.staffBlock} wrap={false}>
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
              <AttendanceDays yearMonth={yearMonth} staff={s} />
            </View>
            <View style={st.row}>
              <Text style={st.label}>合計稼働日数</Text>
              <Text style={st.value}>{s.days}日</Text>
            </View>
            {showItems && (
              <>
                <View style={st.itemHead}>
                  <Text style={[st.cItem, st.small]}>項目</Text>
                  <Text style={[st.cCalc, st.small]}>計算方法</Text>
                  <Text style={[st.cAmt, st.small]}>金額（税抜）</Text>
                </View>
                {staffItems(s).map((it, k) => (
                  <View key={k} style={st.itemRow}>
                    <Text style={st.cItem}>{softWrap(it.label, ITEM_COL_EM)}</Text>
                    <Text style={st.cCalc}>{it.calc}</Text>
                    <Text style={st.cAmt}>{yen(it.amountExTax)}</Text>
                  </View>
                ))}
                <View style={st.subRow}>
                  <Text style={st.subLabel}>小計（税抜）</Text>
                  <Text style={st.cAmt}>{yen(staffBillableExTax(s))}</Text>
                </View>
              </>
            )}
          </View>
  );
}

// 取引先全体の項目(広告費など)の表。広告費(店舗・期間あり)は「イベント主催店舗／イベント開催期間」の表にする。
function ExtrasBlock({ extras }: { extras: StatementExtra[] }) {
  if (!extras.length) return null;
  return (
          <View style={st.staffBlock} wrap={false}>
            <View style={st.staffHead}>
              <Text style={st.staffName}>広告費</Text>
            </View>
            {extras.some((e) => e.store && e.period) && (
              <View>
                <View style={st.itemHead}>
                  <Text style={[st.cStore, st.small]}>イベント主催店舗</Text>
                  <Text style={[st.cPeriod, st.small]}>イベント開催期間</Text>
                  <Text style={[st.cAmt, st.small]}>金額（税抜）</Text>
                </View>
                {extras.filter((e) => e.store && e.period).map((e, k) => (
                  <View key={k} style={st.itemRow}>
                    <Text style={st.cStore}>{e.store}</Text>
                    <Text style={st.cPeriod}>{e.period}</Text>
                    <Text style={st.cAmt}>{yen(e.amountExTax)}</Text>
                  </View>
                ))}
              </View>
            )}
            {extras.some((e) => !(e.store && e.period)) && (
              <View>
                <View style={st.itemHead}>
                  <Text style={[st.cItem, st.small]}>項目</Text>
                  <Text style={[st.cCalc, st.small]}>計算方法</Text>
                  <Text style={[st.cAmt, st.small]}>金額（税抜）</Text>
                </View>
                {extras.filter((e) => !(e.store && e.period)).map((e, k) => (
                  <View key={k} style={st.itemRow}>
                    <Text style={st.cItem}>{softWrap(e.label, ITEM_COL_EM)}</Text>
                    <Text style={st.cCalc}>{e.calc || `${yen(e.amountExTax)}＋税で計算`}</Text>
                    <Text style={st.cAmt}>{yen(e.amountExTax)}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={st.subRow}>
              <Text style={st.subLabel}>小計（税抜）</Text>
              <Text style={st.cAmt}>{yen(extras.reduce((a, e) => a + e.amountExTax, 0))}</Text>
            </View>
          </View>
  );
}

export function isSectioned(data: Pick<StatementSnapshot, "staff" | "clientExtras">) {
  return data.staff.some((s) => s.section?.trim()) || (data.clientExtras ?? []).some((e) => e.section?.trim());
}

// 店舗(区分)ごとにまとめる。並びは、スタッフの行 → 広告費の行で最初に出てきた順。区分のない行は「その他」。
export function sectionsOf(data: Pick<StatementSnapshot, "staff" | "clientExtras">) {
  const OTHER = "その他";
  const map = new Map<string, { name: string; staff: StatementStaff[]; extras: StatementExtra[]; service: number; travel: number; ads: number; other: number; total: number }>();
  const get = (n?: string) => {
    const name = n?.trim() || OTHER;
    if (!map.has(name)) map.set(name, { name, staff: [], extras: [], service: 0, travel: 0, ads: 0, other: 0, total: 0 });
    return map.get(name)!;
  };
  for (const s of data.staff) {
    const g = get(s.section);
    g.staff.push(s);
    g.service += s.serviceExTax ?? 0;
    g.travel += s.travel.amountExTax;
    g.other += (s.extras ?? []).reduce((a, e) => a + e.amountExTax, 0);
    g.total += staffBillableExTax(s);
  }
  for (const e of data.clientExtras ?? []) {
    const g = get(e.section);
    g.extras.push(e);
    if (e.store && e.period) g.ads += e.amountExTax;
    else g.other += e.amountExTax;
    g.total += e.amountExTax;
  }
  return [...map.values()];
}

// 1ページ目: 店舗ごとの合計の表。
function SectionSummary({ data }: { data: StatementSnapshot }) {
  const secs = sectionsOf(data);
  const hasOther = secs.some((x) => x.other > 0);
  const w = hasOther ? ["28%", "15%", "13%", "15%", "12%", "17%"] : ["31%", "18%", "15%", "18%", "18%"];
  const cols: { label: string; v: (x: (typeof secs)[number]) => number }[] = [
    { label: "業務委託費", v: (x) => x.service },
    { label: "交通費相当額", v: (x) => x.travel },
    { label: "広告掲載費", v: (x) => x.ads },
    ...(hasOther ? [{ label: "その他", v: (x: (typeof secs)[number]) => x.other }] : []),
  ];
  const cell = (i: number, right = true) => ({ width: w[i], paddingVertical: 3.5, paddingHorizontal: 5, ...(right ? { textAlign: "right" as const } : {}) });
  const sum = (f: (x: (typeof secs)[number]) => number) => secs.reduce((a, x) => a + f(x), 0);
  return (
    <View style={st.staffBlock} wrap={false}>
      <View style={st.staffHead}>
        <Text style={st.staffName}>店舗別のご請求内訳</Text>
      </View>
      <View style={st.itemHead}>
        <Text style={[cell(0, false), st.small]}>店舗</Text>
        {cols.map((c, i) => (
          <Text key={c.label} style={[cell(i + 1), st.small]}>{c.label}</Text>
        ))}
        <Text style={[cell(cols.length + 1), st.small]}>小計（税抜）</Text>
      </View>
      {secs.map((x) => (
        <View key={x.name} style={st.itemRow}>
          <Text style={cell(0, false)}>{x.name}</Text>
          {cols.map((c, i) => (
            <Text key={c.label} style={cell(i + 1)}>{c.v(x) ? yen(c.v(x)) : "―"}</Text>
          ))}
          <Text style={cell(cols.length + 1)}>{yen(x.total)}</Text>
        </View>
      ))}
      <View style={st.subRow}>
        <Text style={[cell(0, false), st.small]}>合計</Text>
        {cols.map((c, i) => (
          <Text key={c.label} style={cell(i + 1)}>{yen(sum(c.v))}</Text>
        ))}
        <Text style={cell(cols.length + 1)}>{yen(sum((x) => x.total))}</Text>
      </View>
      <Text style={{ fontSize: 8, color: "#555", paddingHorizontal: 6, paddingVertical: 4 }}>店舗ごとの稼働日・計算方法は、次のページ以降に店舗別に記載しています。</Text>
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
  // 手入力: 金額の表は手入力の行(請求書の品目と同じ)に置き換える。スタッフの稼働日・店舗の表は、設定により載せる。
  const manual = data.manualLines?.length ? data.manualLines : null;
  const incl = data.manualTaxMode === "INCL";
  const manualSub = manual ? manual.reduce((a, l) => a + l.quantity * l.unitPriceExTax, 0) : 0;
  // 手入力の「計算方法」は、入力した文章だけを出す。どの行にも入力がなければ、列ごと(「計算方法」の見出しも)出さない。
  const showCalc = !!manual?.some((l) => l.calc?.trim());
  // 店舗別: スタッフの行・広告費の行に店舗(区分)名があれば、1ページ目に店舗ごとの合計、2ページ目以降に店舗ごとの内訳を載せる(請求書は1枚のまま)。
  const sectioned = !manual && isSectioned(data);
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
        <Text style={st.lead}>{manual ? "請求書の内訳です。" : "請求書「業務委託費一式」の内訳です。"}金額は税抜、消費税は合計に対して10%で計算しています。</Text>

        {data.staff.length === 0 && <Text style={st.note}>対象月の稼働実績はありません。</Text>}

        {sectioned ? (
          <SectionSummary data={data} />
        ) : (
          <>
            {(manual && data.manualShowAttendance === false ? [] : data.staff).map((s, i) => (
              <StaffBlock key={`${s.name}-${i}`} yearMonth={data.yearMonth} s={s} showItems={!manual} />
            ))}
          </>
        )}

        {manual && (
          <View style={st.staffBlock} wrap={false}>
            <View style={st.staffHead}>
              <Text style={st.staffName}>ご請求内訳</Text>
            </View>
            <View style={st.itemHead}>
              <Text style={[st.cItem, st.small, ...(showCalc ? [] : [{ width: "78%" }])]}>項目</Text>
              {showCalc && <Text style={[st.cCalc, st.small]}>計算方法</Text>}
              <Text style={[st.cAmt, st.small]}>金額（税抜）</Text>
            </View>
            {manual.map((l, k) => (
              <View key={k} style={st.itemRow}>
                <Text style={[st.cItem, ...(showCalc ? [] : [{ width: "78%" }])]}>{showCalc ? softWrap(l.label, ITEM_COL_EM) : l.label}</Text>
                {showCalc && <Text style={st.cCalc}>{l.calc?.trim() ?? ""}</Text>}
                <Text style={st.cAmt}>{yen(l.quantity * l.unitPriceExTax)}</Text>
              </View>
            ))}
            <View style={st.subRow}>
              <Text style={st.subLabel}>小計（税抜）</Text>
              <Text style={st.cAmt}>{yen(manualSub)}</Text>
            </View>
          </View>
        )}

        {!manual && !sectioned && <ExtrasBlock extras={data.clientExtras ?? []} />}

        <View wrap={false}>
        {!manual && (
          <View style={st.summary}>
            <Text style={st.summaryHead}>ご請求金額のまとめ</Text>
            {summaryRows(data).map((r, i) => (
              <View key={i} style={st.sRow}>
                <Text>{r.label}</Text>
                <Text>{yen(r.amountExTax)}</Text>
              </View>
            ))}
          </View>
        )}

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
      {sectioned &&
        sectionsOf(data).map((sec) => (
          <Page key={sec.name} size="A4" style={st.page}>
            <View style={st.titleWrap}>
              <Text style={st.title}>請求内訳書</Text>
            </View>
            <View style={st.head}>
              <Text style={st.client}>{sec.name}</Text>
              <Text style={st.month}>{y}年{m}月稼働分</Text>
            </View>
            <Text style={st.lead}>{data.clientName}様 ご請求分のうち、{sec.name}の内訳です。金額は税抜です。</Text>
            {sec.staff.map((s, i) => (
              <StaffBlock key={`${s.name}-${i}`} yearMonth={data.yearMonth} s={s} showItems />
            ))}
            <ExtrasBlock extras={sec.extras} />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10 }} wrap={false}>
              <View style={st.totalBox}>
                <View style={[st.sRow, { borderTopWidth: 0, backgroundColor: BLUE }]}>
                  <Text>{sec.name} 小計（税抜）</Text>
                  <Text>{yen(sec.total)}</Text>
                </View>
              </View>
            </View>
          </Page>
        ))}
    </Document>
  );
}
