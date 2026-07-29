import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./world/world.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Echo｜Possible Worlds",
    description: "写下一个困住你的问题，穿越四条世界线，与做出不同选择的自己对话。",
    openGraph: {
      title: "Echo｜Possible Worlds",
      description: "如果人生有另一条路，那里的你，过得好吗？",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "Echo：一扇门通向没走过的人生" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Echo｜Possible Worlds",
      description: "如果人生有另一条路，那里的你，过得好吗？",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
