"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { updateStaffNameAction } from "./actions";

export function NameEditor({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateStaffNameAction(value);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setEditing(true);
        }}
        className="flex items-center gap-1.5 text-sm font-bold text-slate-600"
      >
        <Pencil size={13} className="text-slate-400" />
        名前を変更する
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          disabled={pending}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-amber-400"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white active:scale-95 disabled:opacity-60"
        >
          <Check size={14} />
          保存
        </button>
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
