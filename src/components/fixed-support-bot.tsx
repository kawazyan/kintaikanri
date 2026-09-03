"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, ChevronRight, MessageCircle, Search, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";

type Audience = "staff" | "client";
type Item = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  category: string;
};

type ChatMessage = {
  id: number;
  from: "bot" | "user";
  text: string;
};

const STAFF_ITEMS: Item[] = [
  {
    id: "staff-clock",
    title: "出勤・退勤について",
    category: "勤怠",
    keywords: ["出勤", "退勤", "打刻", "再出勤", "勤務開始", "勤務終了"],
    answer:
      "文字通りです。押してください。ミスったら5分以内であれば修正できます。位置情報も自動回収なので余計な事は考えないように。",
  },
  {
    id: "staff-shift",
    title: "シフトを確認・変更したい",
    category: "勤怠",
    keywords: ["シフト", "予定", "勤務日", "変更", "休み"],
    answer:
      "シフトが確定したら確定分を入力してください。受取予定報酬額も確定している場合は入力してください。",
  },
  {
    id: "staff-money",
    title: "確定金額・支払日を確認したい",
    category: "支払",
    keywords: ["金額", "給料", "報酬", "支払", "振込", "確定", "受取"],
    answer: "ホームからどうぞ確認してください。",
  },
  {
    id: "staff-expense",
    title: "交通費・経費を申請したい",
    category: "申請",
    keywords: ["交通費", "経費", "高速", "宿泊", "ガソリン", "申請"],
    answer:
      "メニューからすすんで申請してください。領収書は写真等で経理課（keiri@kjgroup.info）に送っておいてください。洩れたら振り込みませんよからね。",
  },
  {
    id: "staff-mnp",
    title: "MNP・予約番号について調べたい",
    category: "販売サポート",
    keywords: ["MNP", "予約番号", "転出", "番号移行", "乗り換え"],
    answer: "ここで聞くな。Googleあるだろ。",
  },
  {
    id: "staff-plan",
    title: "料金プランについて調べたい",
    category: "販売サポート",
    keywords: ["プラン", "料金", "ギガ", "GB", "割引", "料金プラン"],
    answer: "調べてください。",
  },
  {
    id: "staff-device",
    title: "機種・端末について調べたい",
    category: "販売サポート",
    keywords: ["機種", "端末", "iPhone", "Pixel", "Android", "eSIM", "SIM"],
    answer: "そういうのはチャッピーにやらせとけばいいんだよ。",
  },
  {
    id: "staff-no-work",
    title: "仕事行きたくない",
    category: "雑談",
    keywords: ["仕事行きたくない", "行きたくない", "サボりたい", "仕事だるい"],
    answer: "皆そうです。行ってください。",
  },
  {
    id: "staff-sick",
    title: "体調が悪い",
    category: "雑談",
    keywords: ["体調が悪い", "体調不良", "しんどい", "だるい"],
    answer: "気のせいです。頑張ってください。",
  },
  {
    id: "staff-really-sick",
    title: "マジで体調が悪い",
    category: "雑談",
    keywords: ["マジで体調が悪い", "本当に体調が悪い", "高熱", "動けない", "救急"],
    answer: "上長の承認取って、即現場責任者等に連絡してください。",
  },
  {
    id: "staff-drink",
    title: "飲みに行きたい",
    category: "雑談",
    keywords: ["飲みに行きたい", "飲み会", "飲みたい", "飲みに行く"],
    answer: "俺も",
  },
];

const CLIENT_ITEMS: Item[] = [
  {
    id: "client-request",
    title: "稼働を依頼したい",
    category: "稼働依頼",
    keywords: ["依頼", "稼働", "申し込み", "申込", "スタッフ"],
    answer:
      "稼働依頼フォームから、会社名・ご担当者様・稼働場所・依頼内容・単価などをご入力ください。担当者様メールアドレスは任意です。",
  },
  {
    id: "client-flow",
    title: "依頼後の流れを知りたい",
    category: "稼働依頼",
    keywords: ["流れ", "承認", "依頼後", "ステータス", "状況"],
    answer:
      "送信された稼働依頼はK.J管理側で確認します。承認後は専用ページから依頼状況・勤怠・請求情報を確認できます。",
  },
  {
    id: "client-change",
    title: "依頼内容を変更したい",
    category: "稼働依頼",
    keywords: ["変更", "修正", "キャンセル", "中止", "追加"],
    answer:
      "依頼内容の変更や追加が必要な場合は、対象の依頼内容が分かる状態でK.J担当者へご連絡ください。",
  },
  {
    id: "client-attendance",
    title: "スタッフの勤怠を確認したい",
    category: "確認",
    keywords: ["勤怠", "出勤", "退勤", "勤務", "時間"],
    answer:
      "承認済みの依頼は専用ページからスタッフの勤怠状況を確認できます。表示は自動更新されます。",
  },
  {
    id: "client-invoice",
    title: "請求書・明細を確認したい",
    category: "請求",
    keywords: ["請求", "請求書", "明細", "PDF", "金額"],
    answer:
      "請求確定後、専用ページから請求書PDFと勤務・請求明細を確認できます。",
  },
  {
    id: "client-staff",
    title: "稼働スタッフについて",
    category: "スタッフ",
    keywords: ["スタッフ", "稼働者", "人員", "人数", "名前"],
    answer:
      "稼働スタッフ名は依頼時に入力できます。登録済みスタッフ一覧にいない方でも、名前を直接入力して依頼できます。",
  },
];

const SMALL_TALK: Array<{ keywords: string[]; answer: string }> = [
  { keywords: ["おはよう", "おはよ"], answer: "おはようございます。今日もよろしくお願いします。" },
  { keywords: ["こんにちは", "こんちは"], answer: "こんにちは。何か確認したいことはありますか？" },
  { keywords: ["こんばんは"], answer: "こんばんは。お疲れさまです。" },
  { keywords: ["ありがとう", "ありがと", "助かった"], answer: "どういたしまして。ほかにもあれば聞いてください。" },
  { keywords: ["疲れた", "つかれた"], answer: "お疲れさまです。必要な確認があればこちらからどうぞ。" },
  { keywords: ["おつかれ", "お疲れ"], answer: "お疲れさまです。今日もありがとうございました。" },
];

function audienceFromPath(pathname: string): Audience | null {
  if (pathname.startsWith("/client")) return "client";
  if (
    pathname.startsWith("/clock") ||
    pathname.startsWith("/menu") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/shift") ||
    pathname.startsWith("/payment") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/my-room") ||
    pathname.startsWith("/notices") ||
    pathname.startsWith("/titles") ||
    pathname.startsWith("/town")
  ) {
    return "staff";
  }
  return null;
}

function findAnswer(input: string, items: Item[], audience: Audience) {
  const q = input.trim().toLowerCase();
  if (!q) return "質問を入力してください。";

  const smallTalk = SMALL_TALK.find((entry) =>
    entry.keywords.some((keyword) => q.includes(keyword.toLowerCase())),
  );
  if (smallTalk) return smallTalk.answer;

  const scored = items
    .map((item) => ({
      item,
      score: item.keywords.reduce(
        (sum, keyword) => sum + (q.includes(keyword.toLowerCase()) ? keyword.length : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].item.answer;

  return audience === "staff"
    ? "この内容はまだBOTに登録されていません。最新情報や個別条件が関係する場合は、各キャリア公式サイトまたは普段使用している検索・AIサービスで確認してください。必要なら管理者へ確認してください。"
    : "この内容はまだBOTに登録されていません。個別のご依頼・契約条件に関する内容は、K.J担当者へお問い合わせください。";
}

export function FixedSupportBot() {
  const pathname = usePathname();
  const audience = audienceFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const nextId = useRef(0);

  const items = audience === "client" ? CLIENT_ITEMS : STAFF_ITEMS;
  const title = audience === "client" ? "K.J ご案内BOT" : "K.J サポートBOT";
  const intro =
    audience === "client"
      ? "稼働依頼・勤怠・請求についてご案内します。"
      : "勤怠・支払・販売サポートについて登録済み情報から回答します。";

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category)));
  }, [items]);

  if (!audience) return null;

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userId = nextId.current++;
    const botId = nextId.current++;
    setMessages((current) => [
      ...current,
      { id: userId, from: "user", text: trimmed },
      { id: botId, from: "bot", text: findAnswer(trimmed, items, audience) },
    ]);
    setInput("");
  };

  const goBack = () => setMessages([]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    ask(input);
  };

  return (
    <>
      {open && (
        <div
          className={`fixed z-[80] flex flex-col overflow-hidden border shadow-[0_24px_70px_rgba(0,0,0,.35)] ${
            audience === "staff"
              ? "bottom-[94px] right-3 left-3 max-h-[72dvh] rounded-[24px] border-white/15 bg-[#08111a] text-white sm:left-auto sm:w-[390px]"
              : "bottom-20 right-3 left-3 max-h-[72dvh] rounded-[24px] border-slate-200 bg-white text-slate-900 sm:left-auto sm:w-[390px]"
          }`}
        >
          <div
            className={`flex items-center gap-3 px-4 py-4 ${
              audience === "staff"
                ? "border-b border-white/10 bg-[linear-gradient(135deg,#14283a,#090f16)]"
                : "border-b border-slate-200 bg-[#14283b] text-white"
            }`}
          >
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/20 bg-white/10">
              <Bot size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-black">{title}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/10"
              aria-label="チャットを閉じる"
            >
              <X size={19} />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm font-bold leading-6 ${
                    audience === "staff" ? "bg-white/[.06] text-slate-200" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {intro}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span
                      key={category}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                        audience === "staff"
                          ? "border border-white/10 bg-white/[.04] text-slate-300"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {category}
                    </span>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => ask(item.title)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition active:scale-[.99] ${
                        audience === "staff"
                          ? "border border-white/10 bg-white/[.045] text-slate-100"
                          : "border border-slate-200 bg-white text-slate-800 shadow-sm"
                      }`}
                    >
                      <span className="flex-1">{item.title}</span>
                      <ChevronRight size={17} className="opacity-60" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={goBack}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition active:scale-[.97] ${
                    audience === "staff"
                      ? "border border-white/10 bg-white/[.04] text-slate-300"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <ArrowLeft size={14} />
                  トピック一覧へ戻る
                </button>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm font-bold leading-6 ${
                        message.from === "user"
                          ? audience === "staff"
                            ? "bg-[#8a231f] text-white"
                            : "bg-[#14283b] text-white"
                          : audience === "staff"
                            ? "border border-white/10 bg-white/[.06] text-slate-200"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={onSubmit}
            className={`flex items-center gap-2 border-t p-3 ${
              audience === "staff" ? "border-white/10 bg-[#050b11]" : "border-slate-200 bg-white"
            }`}
          >
            <div
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 ${
                audience === "staff" ? "border-white/10 bg-white/[.05]" : "border-slate-200 bg-slate-50"
              }`}
            >
              <Search size={16} className="shrink-0 opacity-50" />
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="キーワードで質問"
                className={`h-11 min-w-0 flex-1 border-0 bg-transparent text-sm font-bold outline-none ${
                  audience === "staff" ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
                }`}
              />
            </div>
            <button
              type="submit"
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                audience === "staff" ? "bg-[#e6392f] text-white" : "bg-[#14283b] text-white"
              }`}
              aria-label="質問を送信"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`fixed right-4 z-[79] grid h-14 w-14 place-items-center rounded-full border shadow-[0_10px_28px_rgba(0,0,0,.30)] transition active:scale-95 ${
          audience === "staff"
            ? "bottom-[88px] border-[#e88a6b]/40 bg-[linear-gradient(145deg,#5b1c17,#230b0b)] text-[#ffe4d8] shadow-[0_0_24px_rgba(220,80,70,.22)]"
            : "bottom-4 border-slate-200 bg-[#14283b] text-white"
        }`}
        aria-label="サポートBOTを開く"
      >
        {open ? <X size={24} /> : <MessageCircle size={25} />}
      </button>
    </>
  );
}
