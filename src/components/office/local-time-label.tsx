"use client";
import {useState,useMemo,useEffect} from "react";
import {ProjectedLabel,type LabelLine} from "./projected-label";
export function LocalTimeLabel({ timeZone, lines }: { timeZone: string; lines: LabelLine[] }) {
  const [now, setNow] = useState(() => new Date());
  const formats = useMemo(() => {
    try {
      const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const options = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false } as const;
      return {
        owner: new Intl.DateTimeFormat("pt-BR", { ...options, timeZone }),
        viewer: new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: viewerZone }),
        viewerZone,
      };
    } catch {
      return null;
    }
  }, [timeZone]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!formats) return <ProjectedLabel position={[0, 1.85, 0]} lines={lines} />;
  return <ProjectedLabel position={[0, 2.1, 0]} lines={[
    ...lines,
    { text: timeZone, kind: "meta" },
    { text: `Local ${formats.owner.format(now)}`, kind: "meta" },
    { text: `Você ${formats.viewer.format(now)} · ${formats.viewerZone}`, kind: "meta" },
  ]} />;
}
