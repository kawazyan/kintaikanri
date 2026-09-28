"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { requestGiftExchange } from "./actions";

export function ExchangeButton({
  brand,
  amount,
  coins,
  disabled,
}: {
  brand: string;
  amount: number;
  coins: number;
  disabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    if (!confirm(`${brand} ${amount.toLocaleString()}円分を ${coins.toLocaleString()}コインで交換申請しますか？`)) return;
    setPending(true);
    const result = await requestGiftExchange(brand, amount);
    setPending(false);
    setMsg(result.ok ? "交換申請を受け付けました" : result.error);
  }

  return (
    <div className="coin-shop-rate">
      <button
        type="button"
        onClick={run}
        disabled={disabled || pending}
        className="coin-shop-rate__button"
        aria-label={`${brand} ${amount.toLocaleString()}円分、${coins.toLocaleString()}コイン${disabled ? "、コイン不足" : "で交換申請"}`}
      >
        <span className="coin-shop-rate__details">
          <strong>{amount.toLocaleString()}円</strong>
          <span><i className="coin-shop-silver-coin" aria-hidden="true" />{coins.toLocaleString()}</span>
        </span>
        <ChevronRight size={17} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {pending && <p role="status">申請中...</p>}
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
