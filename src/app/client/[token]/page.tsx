import { redirect } from "next/navigation";

// 旧・取引先登録ベースの入口は廃止。
// 取引先は /client から直接依頼し、送信後は依頼ごとのURLで確認する。
export default function LegacyClientPortalPage() {
  redirect("/client");
}
