"use client";

export function YenInput({
  value,
  onChange,
  autoFocus,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  autoFocus?: boolean;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
    if (digitsOnly === "") {
      onChange(null);
      return;
    }
    onChange(Number(digitsOnly));
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value === null ? "" : value.toLocaleString("ja-JP")}
        onChange={handleChange}
        placeholder="250,000"
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 pr-10 text-right text-base text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
        円
      </span>
    </div>
  );
}
