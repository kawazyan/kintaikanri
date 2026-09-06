"use client";
import { useState } from "react";
import { requestGiftExchange } from "./actions";
export function ExchangeButton({brand,amount,coins,disabled}:{brand:string;amount:number;coins:number;disabled:boolean}){
 const [pending,setPending]=useState(false); const [msg,setMsg]=useState("");
 async function run(){ if(!confirm(`${brand} ${amount.toLocaleString()}円分を ${coins.toLocaleString()}コインで交換申請しますか？`)) return; setPending(true); const r=await requestGiftExchange(brand,amount); setPending(false); setMsg(r.ok?"交換申請を受け付けました":r.error); }
 return <div><button onClick={run} disabled={disabled||pending} className="w-full rounded-xl bg-[#14283b] px-3 py-2.5 text-xs font-black text-white disabled:bg-slate-200 disabled:text-slate-400">{pending?"申請中...":disabled?"コイン不足":"交換する"}</button>{msg&&<p className="mt-1 text-center text-[10px] font-bold text-slate-500">{msg}</p>}</div>
}
