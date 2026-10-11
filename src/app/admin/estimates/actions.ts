"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ESTIMATE_CONFIRM_BCC, type EstimateInput } from "@/lib/estimate";
import { createEstimate, updateEstimate } from "@/lib/estimate-save";
import { sendSavedEstimate } from "@/lib/estimate-send";

export type EstimateActionResult = { ok: true; id: string; message: string } | { ok: false; error: string; id?: string };

// 保存。existingId があれば修正(保存済み・送付済みどちらも)、なければ新規作成。
// sendAfter=true のときは、保存したあとにそのまま送付まで行う(送付は画面の「保存して送付」ボタンを押したときだけ)。
// 保存できても送付に失敗したときは、保存済みのまま残し、id を返す(画面は詳細へ移動して、あとで送付できる)。
export async function saveEstimate(input: EstimateInput, sendAfter: boolean, existingId?: string): Promise<EstimateActionResult> {
  await requireAdmin();
  let id: string;
  let estimateNumber: string;
  try {
    const saved = existingId ? await updateEstimate(existingId, input) : await createEstimate(input);
    id = saved.id;
    estimateNumber = saved.estimateNumber;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "見積書を保存できませんでした。" };
  }
  revalidatePath("/admin/estimates");
  revalidatePath(`/admin/estimates/${id}`);

  if (!sendAfter) return { ok: true, id, message: `保存しました（${estimateNumber}）。まだ取引先へは送っていません。` };

  try {
    const { to, cc, registered } = await sendSavedEstimate(id);
    revalidatePath("/admin/estimates");
    revalidatePath(`/admin/estimates/${id}`);
    revalidatePath("/admin/clients");
    return { ok: true, id, message: `保存して送付しました（${estimateNumber} / 宛先: ${to.join(", ")}${cc.length ? ` / CC: ${cc.join(", ")}` : ""}）。確認用に ${ESTIMATE_CONFIRM_BCC} へも送りました。${registered ? `${registered}。` : ""}` };
  } catch (e) {
    return { ok: false, id, error: `保存しました（${estimateNumber}）が、送付できませんでした: ${e instanceof Error ? e.message : "送付に失敗しました。"}` };
  }
}

// 保存済みの見積書を、あとから送付する。
export async function sendEstimate(id: string): Promise<EstimateActionResult> {
  await requireAdmin();
  try {
    const { to, cc, registered } = await sendSavedEstimate(id);
    revalidatePath("/admin/estimates");
    revalidatePath(`/admin/estimates/${id}`);
    revalidatePath("/admin/clients");
    return { ok: true, id, message: `送付しました（宛先: ${to.join(", ")}${cc.length ? ` / CC: ${cc.join(", ")}` : ""}）。確認用に ${ESTIMATE_CONFIRM_BCC} へも送りました。${registered ? `${registered}。` : ""}` };
  } catch (e) {
    return { ok: false, id, error: e instanceof Error ? e.message : "送付に失敗しました。" };
  }
}

// 削除。保存済みも送付済みも削除できる(送付済みを消すと、送付の記録も一緒に消える)。
export async function deleteEstimate(id: string): Promise<EstimateActionResult> {
  await requireAdmin();
  const e = await prisma.estimate.findUnique({ where: { id }, select: { id: true } });
  if (!e) return { ok: false, error: "見積書が見つかりません。" };
  await prisma.estimate.delete({ where: { id } });
  revalidatePath("/admin/estimates");
  return { ok: true, id, message: "削除しました。" };
}
