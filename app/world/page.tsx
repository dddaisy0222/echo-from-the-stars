"use client";

import { useEffect, useRef, useState } from "react";

type Experience = { destroy?: () => void };

export default function WorldPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let experience: Experience | undefined;
    let cancelled = false;

    import("./engine/MarbleWorld.js")
      .then(({ mountMarbleWorld }) => {
        if (!cancelled) experience = mountMarbleWorld(mount);
      })
      .catch((reason: unknown) => {
        console.error("[Echo] 3D 世界启动失败", reason);
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
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
        <h1>那年的房间没有成功打开</h1>
        <p>{error}</p>
        <a href="/">先回到门外</a>
      </main>
    );
  }

  return <div ref={mountRef} className="world-mount" aria-live="polite" />;
}
