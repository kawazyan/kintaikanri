import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { FixedSupportBot } from "@/components/fixed-support-bot";
import { prisma } from "@/lib/prisma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// スタッフ画面のメインフォント。日本語と欧文数字の両方をカバーする。
const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "勤怠管理システム",
  description: "社内スタッフ用 勤怠管理Webアプリ",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // BOTのFAQは管理画面(BOT管理 → FAQ管理)から編集され、レイアウトが
  // 描画されるたびにここで読み直すので、保存内容はすぐBOTに反映される
  // (再デプロイ不要)。DB接続に失敗してもアプリ全体を落とさないよう、
  // 取得できなければ空配列にフォールバックする。
  const faqs = await prisma.botFaq
    .findMany({
      where: { visible: true },
      orderBy: [{ audience: "asc" }, { sortOrder: "asc" }],
      select: { id: true, audience: true, category: true, question: true, answer: true, keywords: true },
    })
    .catch(() => []);

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <FixedSupportBot faqs={faqs} />
      </body>
    </html>
  );
}
