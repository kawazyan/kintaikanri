import { redirect } from "next/navigation";
import { ArrowLeft, Coins, Gift, History, Sparkles } from "lucide-react";
import Link from "next/link";
import { getStaffId } from "@/lib/auth";
import { syncAndGetGameState } from "@/lib/game";
import { prisma } from "@/lib/prisma";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { ExchangeButton } from "./exchange-button";

const brands=[
 {name:"Amazonギフトカード",mark:"amazon",note:"お買い物に"},{name:"PayPayデジタルギフト",mark:"PayPay",note:"日常のお支払いに"},
 {name:"Starbucks eGift",mark:"STARBUCKS",note:"カフェタイムに"},{name:"タリーズ デジタルギフト",mark:"TULLY'S",note:"コーヒー・フードに"},
 {name:"Apple Gift Card",mark:"Apple",note:"アプリ・サービスに"},{name:"Google Play ギフトコード",mark:"Google Play",note:"Android・アプリに"},
];
const rates=[{amount:500,coins:600},{amount:1000,coins:1100},{amount:3000,coins:3000},{amount:5000,coins:4800}];
export default async function CoinShop(){
 const staffId=await getStaffId(); if(!staffId) redirect("/");
 const [game,history]=await Promise.all([syncAndGetGameState(staffId),prisma.giftExchange.findMany({where:{staffId},orderBy:{requestedAt:"desc"},take:5})]);
 const next=rates.find(r=>r.coins>game.coins);
 return <main className="staff-screen"><div className="mx-auto max-w-[430px] px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
  <div className="mb-4 flex items-center justify-between"><Link href="/clock" className="rounded-full bg-white p-2 shadow"><ArrowLeft size={20}/></Link><div className="text-center"><h1 className="text-xl font-black text-slate-950">COIN SHOP</h1><p className="text-[10px] font-bold text-slate-400">コインを好きなデジタルギフトへ</p></div><span className="w-9"/></div>
  <section className="rounded-[26px] bg-[linear-gradient(135deg,#fff8df,#fff)] p-5 shadow-[0_12px_30px_rgba(15,23,42,.08)] ring-1 ring-amber-100"><div className="flex items-center gap-3"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-white shadow-lg"><Coins/></span><div><p className="text-xs font-black text-slate-500">現在のコイン</p><p className="text-4xl font-black text-slate-950">{game.coins.toLocaleString()} <span className="text-sm text-amber-500">COINS</span></p></div></div>{next&&<p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-center text-xs font-black text-slate-600">{next.amount.toLocaleString()}円ギフトまで <span className="text-amber-600">あと{(next.coins-game.coins).toLocaleString()}コイン</span></p>}</section>
  <div className="mt-5 flex items-center gap-2"><Gift size={16} className="text-red-500"/><h2 className="text-sm font-black text-slate-900">デジタルギフト</h2></div>
  <div className="mt-2 grid grid-cols-2 gap-3">{brands.map(b=><section key={b.name} className="rounded-[22px] bg-white p-3 shadow-[0_8px_22px_rgba(15,23,42,.07)] ring-1 ring-slate-100"><div className="flex h-16 items-center justify-center rounded-2xl bg-slate-50 text-center text-lg font-black text-slate-900">{b.mark}</div><h3 className="mt-2 min-h-9 text-[12px] font-black leading-tight text-slate-900">{b.name}</h3><p className="text-[9px] font-bold text-slate-400">{b.note}</p><div className="mt-2 space-y-2">{rates.map(r=><div key={r.amount} className="rounded-xl bg-slate-50 p-2"><div className="mb-1.5 flex items-center justify-between"><span className="text-[11px] font-black">{r.amount.toLocaleString()}円</span><span className="text-[10px] font-black text-amber-600">🪙 {r.coins.toLocaleString()}</span></div><ExchangeButton brand={b.name} amount={r.amount} coins={r.coins} disabled={game.coins<r.coins}/></div>)}</div></section>)}</div>
  <section className="mt-5 rounded-[22px] bg-white p-4 shadow ring-1 ring-slate-100"><div className="flex items-center gap-2"><Sparkles size={16} className="text-amber-500"/><h2 className="text-sm font-black">コインの貯め方</h2></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-slate-50 p-2"><b className="text-lg">+30</b><p className="text-[9px] font-bold text-slate-500">1勤務完了</p></div><div className="rounded-xl bg-slate-50 p-2"><b className="text-lg">+100</b><p className="text-[9px] font-bold text-slate-500">月間皆勤</p></div><div className="rounded-xl bg-slate-50 p-2"><b className="text-lg">+100</b><p className="text-[9px] font-bold text-slate-500">PERFECT</p></div></div><p className="mt-2 text-[9px] font-bold leading-relaxed text-slate-400">PERFECT：欠勤0・遅刻0・早退0・打刻漏れ0。月間ボーナスは月末確定後に付与され、コインは翌月以降へ繰り越されます。</p></section>
  {history.length>0&&<section className="mt-5 rounded-[22px] bg-white p-4 shadow ring-1 ring-slate-100"><div className="flex items-center gap-2"><History size={16}/><h2 className="text-sm font-black">交換履歴</h2></div><div className="mt-2 divide-y">{history.map(h=><div key={h.id} className="flex items-center justify-between py-2 text-xs"><div><b>{h.brand}</b><p className="text-[10px] text-slate-400">{h.amountYen.toLocaleString()}円分</p></div><div className="text-right"><b className="text-red-500">-{h.coinsUsed.toLocaleString()}</b><p className="text-[9px] font-bold text-slate-400">{h.status==="REQUESTED"?"申請中":h.status==="FULFILLED"?"交換済み":"却下"}</p></div></div>)}</div></section>}
 </div><BottomTabBar/></main>
}
