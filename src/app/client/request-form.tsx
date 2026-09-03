"use client";

import { useState } from "react";
import { Building2, CalendarDays, MapPin, Plus, Trash2, UserRound, WalletCards } from "lucide-react";
import { submitClientRequest } from "./actions";

const inputClass = "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] font-bold text-slate-900 outline-none transition focus:border-[#24415c] focus:ring-4 focus:ring-[#24415c]/10";
const labelClass = "block text-[13px] font-black text-slate-700";

export function ClientRequestForm() {
  const [requestType, setRequestType] = useState("BAND");
  const [schedulePattern, setSchedulePattern] = useState("FIXED");
  const [contractType, setContractType] = useState("MONTHLY");
  const [names, setNames] = useState([""]);
  const [days, setDays] = useState([{ date: "", start: "10:00", end: "19:00" }]);

  const isBand = requestType === "BAND";

  function changeRequestType(value: string) {
    setRequestType(value);
    if (value !== "BAND") setContractType("DAILY");
  }

  return (
    <form action={submitClientRequest} className="space-y-5">
      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_40px_rgba(15,23,42,.08)] ring-1 ring-black/5">
        <div className="flex items-center gap-3 bg-[#14283b] px-5 py-4 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><Building2 size={20}/></span>
          <div><p className="text-[11px] font-black tracking-[.16em] text-slate-300">REQUESTER</p><h2 className="font-black">ご依頼元情報</h2></div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className={labelClass}>依頼会社名<input name="companyName" className={inputClass} placeholder="株式会社〇〇" /></label>
          <label className={labelClass}>担当者様名<input name="contactName" className={inputClass} placeholder="山田 太郎" /></label>
          <label className={labelClass}>担当者様部署<input name="contactDepartment" className={inputClass} placeholder="営業部" /></label>
          <label className={labelClass}>担当者様連絡先<input name="phone" inputMode="tel" className={inputClass} placeholder="090-0000-0000" /></label>
          <label className={`${labelClass} sm:col-span-2`}>担当者様メールアドレス（任意）<input name="email" type="email" className={inputClass} placeholder="example@company.jp" /></label>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_40px_rgba(15,23,42,.08)] ring-1 ring-black/5">
        <div className="flex items-center gap-3 bg-[#14283b] px-5 py-4 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><MapPin size={20}/></span>
          <div><p className="text-[11px] font-black tracking-[.16em] text-slate-300">WORK ORDER</p><h2 className="font-black">稼働依頼内容</h2></div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className={labelClass}>稼働依頼キャリア<select name="carrier" className={inputClass} defaultValue=""><option value="" disabled>選択してください</option><option>au</option><option>UQ mobile</option><option>SoftBank</option><option>Y!mobile</option><option>docomo</option><option>楽天モバイル</option><option>その他</option></select></label>
          <label className={labelClass}>稼働場所<input name="storeName" className={inputClass} placeholder="店舗名・会場名" /></label>
          <label className={`${labelClass} sm:col-span-2`}>依頼内容<select name="requestType" value={requestType} onChange={(e)=>changeRequestType(e.target.value)} className={inputClass}><option value="CATCH">キャッチ</option><option value="CLOSER">クローザー</option><option value="BAND">帯稼働</option><option value="CONSULTING">コンサルティング</option></select></label>
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between"><p className="text-[13px] font-black text-slate-700">稼働者名（バイネーム）</p><button type="button" onClick={()=>setNames([...names,""])} className="flex items-center gap-1 rounded-xl bg-[#eef2f5] px-3 py-2 text-xs font-black text-[#14283b]"><Plus size={14}/>追加</button></div>
            <div className="grid gap-2 sm:grid-cols-2">{names.map((_,i)=><div key={i} className="flex gap-2"><input name="requestedNames" className={`${inputClass} mt-0`} placeholder={`稼働者名（バイネーム） ${i+1}`} /><button type="button" disabled={names.length===1} onClick={()=>setNames(names.filter((_,x)=>x!==i))} className="grid w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 text-slate-400 disabled:opacity-30"><Trash2 size={17}/></button></div>)}</div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_40px_rgba(15,23,42,.08)] ring-1 ring-black/5">
        <div className="flex items-center gap-3 bg-[#14283b] px-5 py-4 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><CalendarDays size={20}/></span>
          <div><p className="text-[11px] font-black tracking-[.16em] text-slate-300">SCHEDULE</p><h2 className="font-black">稼働日・時間</h2></div>
        </div>
        <div className="space-y-4 p-5">
          {isBand ? <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>対象月<input name="yearMonth" type="month" className={inputClass}/></label><label className={labelClass}>予定稼働日数<input name="plannedDays" type="number" min="1" className={inputClass} placeholder="20"/></label></div> : <div className="rounded-2xl bg-[#f3f6f8] p-4 text-sm font-bold text-slate-600">スポット依頼は、実際に稼働する日を下で入力してください。</div>}
          <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>稼働時間<select name="schedulePattern" value={schedulePattern} onChange={(e)=>setSchedulePattern(e.target.value)} className={inputClass}><option value="FIXED">毎日同じ時間</option><option value="VARIES">日によって異なる</option></select></label></div>
          {schedulePattern === "FIXED" && <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>開始時間<input name="fixedStartTime" type="time" className={inputClass}/></label><label className={labelClass}>終了時間<input name="fixedEndTime" type="time" className={inputClass}/></label></div>}
          {!isBand && <div><div className="mb-2 flex items-center justify-between"><p className="text-[13px] font-black text-slate-700">スポット稼働日</p><button type="button" onClick={()=>setDays([...days,{date:"",start:"10:00",end:"19:00"}])} className="flex items-center gap-1 rounded-xl bg-[#eef2f5] px-3 py-2 text-xs font-black text-[#14283b]"><Plus size={14}/>日付追加</button></div><div className="space-y-2">{days.map((day,i)=><div key={i} className={`grid gap-2 ${schedulePattern==="VARIES"?"sm:grid-cols-[1fr_1fr_1fr_auto]":"sm:grid-cols-[1fr_auto]"}`}><input name="scheduleDate" type="date" className={`${inputClass} mt-0`}/>{schedulePattern==="VARIES"&&<><input name="scheduleStart" type="time" defaultValue={day.start} className={`${inputClass} mt-0`}/><input name="scheduleEnd" type="time" defaultValue={day.end} className={`${inputClass} mt-0`}/></>}<button type="button" disabled={days.length===1} onClick={()=>setDays(days.filter((_,x)=>x!==i))} className="grid min-h-12 w-12 place-items-center rounded-2xl border border-slate-200 text-slate-400 disabled:opacity-30"><Trash2 size={17}/></button></div>)}</div></div>}
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_40px_rgba(15,23,42,.08)] ring-1 ring-black/5">
        <div className="flex items-center gap-3 bg-[#14283b] px-5 py-4 text-white"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><WalletCards size={20}/></span><div><p className="text-[11px] font-black tracking-[.16em] text-slate-300">CONDITION</p><h2 className="font-black">単価・条件</h2></div></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className={labelClass}>単価区分<select name="contractType" value={contractType} disabled={!isBand} onChange={(e)=>setContractType(e.target.value)} className={inputClass}><option value="DAILY">日単価</option>{isBand&&<option value="MONTHLY">月額固定</option>}</select>{!isBand&&<input type="hidden" name="contractType" value="DAILY"/>}</label>
          <label className={labelClass}>単価（税抜）<input name="rateAmountExTax" type="number" min="0" className={inputClass} placeholder={contractType==="MONTHLY"?"600000":"30000"}/></label>
          {isBand && contractType === "MONTHLY" && <label className={labelClass}>欠勤時の減算<select name="absenceDeduction" className={inputClass}><option value="YES">減算あり（月額 ÷ 予定稼働日数）</option><option value="NO">減算なし</option><option value="CONSULT">要相談</option></select></label>}
          {!(isBand && contractType === "MONTHLY") && <input type="hidden" name="absenceDeduction" value="NO"/>}
          <label className={labelClass}>交通費<select name="travelExpense" className={inputClass}><option value="INCLUDED">単価に込み</option><option value="SEPARATE">別途請求</option><option value="CONSULT">要相談</option></select></label>
          <label className={`${labelClass} sm:col-span-2`}>備考・特記事項<textarea name="notes" rows={4} className={inputClass} placeholder="事前共有事項があれば入力してください。"/></label>
        </div>
      </section>

      <button className="group flex w-full items-center justify-center gap-3 rounded-[22px] bg-[#b4232c] px-5 py-4.5 font-black text-white shadow-[0_6px_0_#74151b,0_12px_26px_rgba(180,35,44,.20)] transition active:translate-y-1 active:shadow-[0_2px_0_#74151b]"><UserRound size={20}/><span>この内容で稼働を依頼する</span></button>
      <p className="text-center text-xs font-bold leading-6 text-slate-400">送信後は管理者の確認・承認待ちになります。<br/>誤った内容で送信してしまった場合は、お手数ですが正しい内容で改めて送信してください。</p>
    </form>
  );
}
