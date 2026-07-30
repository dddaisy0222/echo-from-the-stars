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
    title: "Echo｜人生的第二层",
    description: "推开一扇门，进入那条没有走过、却已经替你生活了五年的人生。",
    openGraph: {
      title: "Echo｜人生的第二层",
      description: "另一条人生不是空白。另一个你，已经在那里生活了五年。",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "Echo：一扇门通向没走过的人生" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Echo｜人生的第二层",
      description: "推开一扇门，去见那个已经替你生活了五年的自己。",
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
