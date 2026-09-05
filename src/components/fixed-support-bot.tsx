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

// スタッフ向け/取引先向けのFAQ本体は 管理画面 → BOT管理 → FAQ管理 で
// 編集する(prisma の BotFaq テーブル)。ここではDBから受け取った内容を
// 既存の Item 形状に変換するだけ。雑談的な定型あいさつ(SMALL_TALK)は
// FAQ一覧のトピックボタンとしては表示しない従来仕様のため、引き続き
// ここに残す。
export type BotFaqData = {
  id: string;
  audience: "STAFF" | "CLIENT";
  category: string;
  question: string;
  answer: string;
  keywords: string | null;
};

function toItem(faq: BotFaqData): Item {
  const extraKeywords = faq.keywords
    ? faq.keywords.split(",").map((k) => k.trim()).filter(Boolean)
    : [];
  return {
    id: faq.id,
    title: faq.question,
    category: faq.category,
    answer: faq.answer,
    // 質問文自体も検索キーワードに含めるので、追加キーワードを未入力
    // のままでも質問文で普通に一致する。
    keywords: [faq.question, ...extraKeywords],
  };
}

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

export function FixedSupportBot({ faqs }: { faqs: BotFaqData[] }) {
  const pathname = usePathname();
  const audience = audienceFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const nextId = useRef(0);

  const items = useMemo(
    () =>
      faqs
        .filter((f) => f.audience === (audience === "client" ? "CLIENT" : "STAFF"))
        .map(toItem),
    [faqs, audience]
  );
  const title = audience === "client" ? "K.J ご案内BOT" : "K.J サポートBOT";
  const intro =
    audience === "client"
      ? "稼働依頼・勤怠・請求についてご案内します。まずはカテゴリを選んでください。"
      : "勤怠・支払・販売サポートについて登録済み情報から回答します。まずはカテゴリを選んでください。";

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category)));
  }, [items]);

  // ページ遷移で audience が切り替わった場合など、選択中のカテゴリが
  // 今の一覧に存在しなければカテゴリ選択からやり直させる。
  const currentCategory = activeCategory && categories.includes(activeCategory) ? activeCategory : null;
  const topicsInCategory = useMemo(
    () => (currentCategory ? items.filter((item) => item.category === currentCategory) : []),
    [items, currentCategory]
  );

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

  // 回答画面から一段階だけ戻る(選んでいたカテゴリのトピック一覧へ)。
  const goBack = () => setMessages([]);
  // トピック一覧からさらに一段階戻って、カテゴリ選択からやり直す。
  const goBackToCategories = () => setActiveCategory(null);

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
                  {currentCategory ? currentCategory : intro}
                </div>

                {currentCategory === null ? (
                  <div className="mt-4 space-y-2">
                    {categories.map((category) => {
                      const count = items.filter((item) => item.category === category).length;
                      return (
                        <button
                          type="button"
                          key={category}
                          onClick={() => setActiveCategory(category)}
                          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition active:scale-[.99] ${
                            audience === "staff"
                              ? "border border-white/10 bg-white/[.045] text-slate-100"
                              : "border border-slate-200 bg-white text-slate-800 shadow-sm"
                          }`}
                        >
                          <span className="flex-1">{category}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                              audience === "staff" ? "bg-white/[.08] text-slate-400" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {count}
                          </span>
                          <ChevronRight size={17} className="opacity-60" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={goBackToCategories}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition active:scale-[.97] ${
                        audience === "staff"
                          ? "border border-white/10 bg-white/[.04] text-slate-300"
                          : "border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <ArrowLeft size={14} />
                      カテゴリ一覧へ戻る
                    </button>
                    {topicsInCategory.map((item) => (
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
                )}
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
                      className={`max-w-[86%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm font-bold leading-6 ${
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
