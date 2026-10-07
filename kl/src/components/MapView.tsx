"use client";

import { useEffect, useRef } from "react";
import type { GameMap, MapCallbacks } from "@/world/GameMap";
import type { WorldMap } from "@/world";
import { getGameStore } from "@/store";

interface Props extends MapCallbacks {
  /** Pause drawing (for example while an interior is open). */
  active?: boolean;
  onReady?: (map: GameMap) => void;
  /** The LGA map to draw. Omit for the hand-built Ilorin map. Give the component a key per map to redraw. */
  world?: WorldMap | null;
}

/** Hosts the Pixi map. Pixi only loads in the browser. */
export default function MapView({ active = true, onReady, onBillboard, world }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<GameMap | null>(null);
  const cbs = useRef({ onReady, onBillboard });
  useEffect(() => {
    cbs.current = { onReady, onBillboard };
  });

  useEffect(() => {
    let alive = true;
    let created: GameMap | null = null;
    (async () => {
      const { GameMap } = await import("@/world/GameMap");
      if (!alive || !host.current) return;
      created = await GameMap.create(host.current, getGameStore(), { onBillboard: (id) => cbs.current.onBillboard?.(id) }, world ?? undefined);
      if (!alive) return created.destroy();
      map.current = created;
      cbs.current.onReady?.(created);
    })();
    return () => {
      alive = false;
      created?.destroy();
      map.current = null;
    };
  }, [world]);

  useEffect(() => {
    map.current?.setActive(active);
  }, [active]);

  return <div ref={host} className="absolute inset-0" aria-label="Town map" role="img" />;
}
