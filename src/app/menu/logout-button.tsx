"use client";

import { LogOut } from "lucide-react";
import { switchUser } from "../identify-actions";

export function LogoutButton() {
  return (
    <form
      action={switchUser}
      onSubmit={(event) => {
        if (!window.confirm("ログアウトしますか？\nこの端末のスタッフ選択が解除されます。")) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] border border-red-100 bg-white px-4 py-3 text-sm font-black text-red-600 shadow-[0_6px_18px_rgba(15,23,42,.06)] transition active:scale-[.985] active:bg-red-50"
      >
        <LogOut size={18} strokeWidth={2.35} />
        ログアウト
      </button>
    </form>
  );
}
