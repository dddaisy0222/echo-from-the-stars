import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Echo｜来自星星的我",
    description: "一场与过去、未来和平行时空中的自己对话的意识航行。",
    openGraph: {
      title: "Echo｜来自星星的我",
      description: "穿越时间与可能性，听见来自另一个自己的回声。",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "Echo 内在宇宙星图" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Echo｜来自星星的我",
      description: "穿越时间与可能性，听见来自另一个自己的回声。",
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
