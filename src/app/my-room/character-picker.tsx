"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, Camera, Ban } from "lucide-react";
import {
  CHARACTER_DEFINITIONS,
  avatarImagePath,
  NONE_CHARACTER_ID,
  CUSTOM_CHARACTER_ID,
  type AvatarState,
} from "@/lib/character-config";
import { selectCharacterAction, saveCustomAvatarAction } from "./actions";

const UPLOAD_SLOTS: { state: AvatarState; label: string }[] = [
  { state: "HOME", label: "出勤前" },
  { state: "WORK", label: "出勤中" },
  { state: "NIGHT", label: "退勤後" },
];

// アップロード画像はDBにdata URLとして保存するため、クライアント側であらかじめ
// 縮小・圧縮してから送る(そのままだと数MBになり得るため)。
const MAX_DIMENSION = 640;
const JPEG_QUALITY = 0.75;

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("読み込みに失敗しました"));
    reader.onload = () => {
      const img = document.createElement("img");
      img.onerror = () => reject(new Error("画像を読み込めませんでした"));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("画像を処理できませんでした"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function CharacterPicker({
  selectedCharacterId,
  customAvatars,
}: {
  selectedCharacterId: string;
  customAvatars: { home: string | null; work: string | null; night: string | null };
}) {
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSelect(characterId: string) {
    if (characterId === selectedCharacterId || pending) return;
    setError(null);
    setPendingId(characterId);
    startTransition(async () => {
      const result = await selectCharacterAction(characterId);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
      setPendingId(null);
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {CHARACTER_DEFINITIONS.map((character) => {
          const isSelected = character.id === selectedCharacterId;
          const isBusy = pending && pendingId === character.id;
          const isNone = character.id === NONE_CHARACTER_ID;
          const isCustom = character.id === CUSTOM_CHARACTER_ID;
          const customPreview = customAvatars.home ?? customAvatars.work ?? customAvatars.night;
          return (
            <button
              key={character.id}
              type="button"
              disabled={pending}
              onClick={() => handleSelect(character.id)}
              className={`relative overflow-hidden rounded-2xl border-2 text-left transition active:scale-[0.98] disabled:opacity-70 ${
                isSelected ? "border-red-500 shadow-[0_4px_14px_rgba(220,38,38,0.2)]" : "border-slate-200"
              }`}
            >
              <div className="relative aspect-[3/4] w-full bg-slate-100">
                {isNone ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-400">
                    <Ban size={26} />
                    <span className="text-[11px] font-bold">非表示</span>
                  </div>
                ) : isCustom && !customPreview ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-400">
                    <Camera size={26} />
                    <span className="text-[11px] font-bold">写真を追加</span>
                  </div>
                ) : (
                  <Image
                    src={isCustom ? customPreview! : avatarImagePath(character.id, "HOME")}
                    alt={character.label}
                    fill
                    sizes="200px"
                    unoptimized={isCustom}
                    className="object-cover object-top"
                  />
                )}
                {isSelected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
                {isBusy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <span className="text-xs font-semibold text-slate-600">変更中...</span>
                  </div>
                )}
              </div>
              <p className="px-3 py-2 text-center text-sm font-bold text-slate-800">{character.label}</p>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-center text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-black text-slate-500">自分の写真を設定(出勤前・出勤中・退勤後)</p>
        <div className="grid grid-cols-3 gap-2.5">
          {UPLOAD_SLOTS.map((slot) => (
            <UploadSlot
              key={slot.state}
              state={slot.state}
              label={slot.label}
              currentUrl={
                slot.state === "HOME" ? customAvatars.home : slot.state === "WORK" ? customAvatars.work : customAvatars.night
              }
              onSaved={() => router.refresh()}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadSlot({
  state,
  label,
  currentUrl,
  onSaved,
}: {
  state: AvatarState;
  label: string;
  currentUrl: string | null;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const dataUrl = await resizeImageFile(file);
      const result = await saveCustomAvatarAction(state, dataUrl);
      if ("error" in result) {
        setError(result.error);
      } else {
        onSaved();
      }
    } catch {
      setError("アップロードに失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 disabled:opacity-70"
      >
        {currentUrl ? (
          <Image src={currentUrl} alt={label} fill sizes="150px" unoptimized className="object-cover object-top" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
            <Camera size={20} />
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="text-[10px] font-bold text-slate-600">処理中...</span>
          </div>
        )}
      </button>
      <p className="text-[11px] font-bold text-slate-600">{label}</p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && <p className="text-center text-[10px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
