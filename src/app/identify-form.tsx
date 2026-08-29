"use client";

import { useActionState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Hash, LoaderCircle, ShieldCheck } from "lucide-react";
import { confirmStaffLogin, identifyStaff, type IdentifyState } from "./identify-actions";

const initialState: IdentifyState = { step: "input" };

export function IdentifyForm() {
  const [state, formAction, pending] = useActionState(identifyStaff, initialState);

  if (state.step === "confirm") {
    return (
      <div className="animate-[loginFade_.28s_ease-out]">
        <div className="mb-7 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#fff4ee] ring-1 ring-[#f4d8ca]">
            <BadgeCheck className="h-8 w-8 text-[#e9652a]" strokeWidth={1.9} />
          </div>
        </div>

        <div className="text-center">
          <p className="text-[12px] font-bold tracking-[0.18em] text-[#9b8c84]">本人確認</p>
          <h2 className="mt-3 text-[25px] font-bold tracking-[-0.03em] text-[#2e3541]">
            {state.staffName} <span className="text-[18px] font-semibold">さんですか？</span>
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-[#7d8793]">
            ご本人で間違いなければログインしてください
          </p>
        </div>

        <div className="mt-7 rounded-2xl border border-[#ece8e4] bg-[#faf9f7] px-4 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[#8c929b]">
              <Hash className="h-4 w-4" />
              社員コード
            </div>
            <span className="font-mono text-[13px] font-bold tracking-[0.08em] text-[#414955]">
              {state.employeeCode}
            </span>
          </div>
        </div>

        <form action={confirmStaffLogin} className="mt-5">
          <input type="hidden" name="employeeCode" value={state.employeeCode} />
          <button
            type="submit"
            className="group flex h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-[#ea692d] px-5 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(234,105,45,.22)] transition active:scale-[.985] active:bg-[#d95d25]"
          >
            はい、ログインする
            <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" />
          </button>
        </form>

        <button
          type="button"
          onClick={() => { window.location.href = "/"; }}
          className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold text-[#737b86] transition hover:bg-[#f7f5f2] active:scale-[.99]"
        >
          <ArrowLeft className="h-4 w-4" />
          違います
        </button>

      </div>
    );
  }

  return <InputView action={formAction} pending={pending} error={state.error} />;
}

type InputViewProps = {
  action: (payload: FormData) => void;
  pending?: boolean;
  error?: string;
};

function InputView({ action, pending = false, error }: InputViewProps) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="employeeCode" className="mb-2 block text-[12px] font-bold tracking-[0.04em] text-[#626c78]">
          社員コード
        </label>
        <div className="relative">
          <Hash className="pointer-events-none absolute left-4 top-1/2 h-[19px] w-[19px] -translate-y-1/2 text-[#a5adb8]" />
          <input
            id="employeeCode"
            type="text"
            name="employeeCode"
            required
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="社員コードを入力"
            aria-invalid={Boolean(error)}
            className="h-[60px] w-full rounded-2xl border border-[#ddd8d2] bg-white pl-12 pr-4 text-[16px] font-semibold text-[#29313d] outline-none transition placeholder:font-medium placeholder:text-[#b0b6bf] focus:border-[#ed8a5b] focus:ring-4 focus:ring-[#f7e3d8] aria-[invalid=true]:border-[#e05a56] aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-[#fae1df]"
          />
        </div>
        {error && (
          <p className="mt-2.5 rounded-xl bg-[#fff2f1] px-3 py-2.5 text-[12px] font-semibold text-[#c94743]" role="alert">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group flex h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-[#ea692d] px-5 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(234,105,45,.22)] transition active:scale-[.985] active:bg-[#d95d25] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <LoaderCircle className="h-[18px] w-[18px] animate-spin" />
            確認中...
          </>
        ) : (
          <>
            確認する
            <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>

      <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#9ca3ad]">
        <ShieldCheck className="h-3.5 w-3.5" />
        社員専用・本人確認後にログインします
      </div>
    </form>
  );
}
