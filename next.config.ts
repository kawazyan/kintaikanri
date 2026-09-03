import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  // Allows the dev server to accept requests (including Server Actions)
  // from phones on the same LAN, not just localhost. This IP can change
  // when the dev machine reconnects to Wi-Fi — update it if that happens.
  // The trycloudflare.com wildcard allows the Cloudflare Quick Tunnel used
  // for external/internet access; its subdomain changes every time the
  // tunnel is restarted, so a wildcard is used instead of a fixed hostname.
  allowedDevOrigins: ["192.168.10.102", "192.168.0.11", "*.trycloudflare.com"],
  // 請求書PDF生成(@react-pdf/renderer)がビルド時のトレース解析では拾われない
  // 実行時パスでフォント・画像ファイルを読むため、デプロイ時に確実に含める。
  outputFileTracingIncludes: {
    "/invoice/\\[id\\]/pdf": ["./src/assets/fonts/**/*", "./src/assets/invoice/**/*"],
  },
};

export default nextConfig;
