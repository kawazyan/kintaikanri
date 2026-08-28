"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check } from "lucide-react";
import { CHARACTER_DEFINITIONS, avatarImagePath } from "@/lib/character-config";
import { selectCharacterAction } from "./actions";

export function CharacterPicker({ selectedCharacterId }: { selectedCharacterId: string }) {
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
                <Image
                  src={avatarImagePath(character.id, "HOME")}
                  alt={character.label}
                  fill
                  sizes="200px"
                  className="object-cover object-top"
                />
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
    </div>
  );
}
