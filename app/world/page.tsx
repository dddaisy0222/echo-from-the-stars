"use client";

import { useEffect, useRef, useState } from "react";

type WorldExperience = {
  destroy?: () => void;
};

export default function WorldPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let experience: WorldExperience | undefined;
    let cancelled = false;

    import("./engine/MarbleWorld.js")
      .then(({ mountMarbleWorld }) => {
        if (cancelled || !mountRef.current) return;
        experience = mountMarbleWorld(mountRef.current);
      })
      .catch((cause) => {
        console.error("[Echo] 记忆房间启动失败", cause);
        setError(cause instanceof Error ? cause.message : "房间暂时没有想起你。");
      });

    return () => {
      cancelled = true;
      experience?.destroy?.();
    };
  }, []);

  if (error) {
    return (
      <main className="fatal-page">
        <p className="eyebrow">ECHO / WORLD ERROR</p>
        <h1>无法进入那年的房间</h1>
        <p>{error}</p>
        <a href="/">返回世界入口</a>
      </main>
    );
  }

  return <div ref={mountRef} className="echo-world-mount" />;
}
