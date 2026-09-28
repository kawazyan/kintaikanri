import { redirect } from "next/navigation";
import { Gift, History, Sparkles } from "lucide-react";
import Image from "next/image";
import { getStaffId } from "@/lib/auth";
import { syncAndGetGameState } from "@/lib/game";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { ExchangeButton } from "./exchange-button";

const brands = [
  { name: "Amazonギフトカード", art: "amazon", note: "お買い物に" },
  { name: "PayPayデジタルギフト", art: "paypay", note: "日常のお支払いに" },
  { name: "Starbucks eGift", art: "starbucks", note: "カフェタイムに" },
  { name: "タリーズ デジタルギフト", art: "tullys", note: "コーヒー・フードに" },
  { name: "Apple Gift Card", art: "apple", note: "アプリ・サービスに" },
  { name: "Google Play ギフトコード", art: "google", note: "Android・アプリに" },
];
const rates = [
  { amount: 500, coins: 600 }, { amount: 1000, coins: 1100 },
  { amount: 3000, coins: 3000 }, { amount: 5000, coins: 4800 },
];

export default async function CoinShop() {
  const staffId = await getStaffId();
  if (!staffId) redirect("/");
  const [game, history] = await Promise.all([
    syncAndGetGameState(staffId),
    prisma.giftExchange.findMany({ where: { staffId }, orderBy: { requestedAt: "desc" }, take: 5 }),
  ]);

  return (
    <main className="staff-screen coin-shop-screen">
      <div className="mx-auto max-w-[430px] px-3 pb-28 pt-[calc(86px_+_env(safe-area-inset-top))]">
        <header className="coin-shop-heading">
          <div className="coin-shop-heading__title">
            <Gift size={28} strokeWidth={2.2} aria-hidden="true" />
            <div><h1>コイン交換所</h1><p>貯めたコインを好きなギフトと交換できます</p></div>
          </div>
          <div className="coin-shop-balance" aria-label={`現在のコイン ${game.coins.toLocaleString()}`}>
            <span className="coin-shop-balance__coin" aria-hidden="true" />
            <div><p>現在のコイン</p><strong>{game.coins.toLocaleString()}</strong></div>
          </div>
        </header>
        <div className="coin-shop-grid">
          {brands.map((brand) => (
            <section key={brand.name} className="coin-shop-card">
              <div className={`coin-shop-card__art coin-shop-card__art--${brand.art}`} role="img" aria-label={`${brand.name}のギフトカード画像`}>
                <Image src="/coin-shop-reference.png" alt="" width={850} height={1850} unoptimized />
              </div>
              <h3>{brand.name}</h3>
              <p className="coin-shop-card__note">{brand.note}</p>
              <div className="coin-shop-card__rates">
                {rates.map((rate) => (
                  <ExchangeButton key={rate.amount} brand={brand.name} amount={rate.amount} coins={rate.coins} disabled={game.coins < rate.coins} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <section className="coin-shop-info">
          <div className="coin-shop-info__body">
            <div className="coin-shop-stack" aria-hidden="true" />
            <div className="coin-shop-info__content">
              <div className="coin-shop-section-title"><Sparkles size={20} /><h2>コインの貯め方</h2></div>
              <div className="coin-shop-earnings"><div><b>+30</b><span>1勤務完了</span></div><div><b>+100</b><span>月間皆勤</span></div><div><b>+100</b><span>PERFECT</span></div></div>
            </div>
          </div>
          <p>PERFECT：欠勤0・遅刻0・早退0・打刻漏れ0。月間ボーナスは月末確定後に付与され、コインは翌月以降へ繰り越されます。</p>
        </section>
        {history.length > 0 && (
          <section className="coin-shop-info coin-shop-history">
            <div className="coin-shop-section-title"><History size={18} /><h2>交換履歴</h2></div>
            {history.map((item) => (
              <div key={item.id} className="coin-shop-history__row">
                <div><strong>{item.brand}</strong><p>{item.amountYen.toLocaleString()}円分</p></div>
                <div className="text-right"><strong>−{item.coinsUsed.toLocaleString()}</strong><p>{item.status === "REQUESTED" ? "申請中" : item.status === "FULFILLED" ? "交換済み" : "却下"}</p></div>
              </div>
            ))}
          </section>
        )}
      </div>
      <BottomTabBar />
    </main>
  );
}
