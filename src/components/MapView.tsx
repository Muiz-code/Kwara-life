"use client";

import { useEffect, useRef, useState } from "react";
import type { MapCallbacks } from "@/world/GameMap";
import type { MapHandle } from "@/world/handle";
import type { WorldMap } from "@/world";
import { getGameStore } from "@/store";
import Loader from "./game/Loader";

interface Props extends MapCallbacks {
  /** Pause drawing (for example while an interior is open). */
  active?: boolean;
  onReady?: (map: MapHandle) => void;
  /** The LGA map to draw. Omit for the hand-built Ilorin map. Give the component a key per map to redraw. */
  world?: WorldMap | null;
}

/** Hosts the map: the town in 3D, or the flat Pixi map with ?2d. Both only load in the browser. */
export default function MapView({ active = true, onReady, onBillboard, world }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapHandle | null>(null);
  const [ready, setReady] = useState(false);
  const cbs = useRef({ onReady, onBillboard });
  useEffect(() => {
    cbs.current = { onReady, onBillboard };
  });

  useEffect(() => {
    let alive = true;
    let created: MapHandle | null = null;
    (async () => {
      const callbacks = { onBillboard: (id: string) => cbs.current.onBillboard?.(id) };
      const flat = new URLSearchParams(window.location.search).has("2d");
      const town = world ?? (await import("@/world/ilorin-town")).ilorinTown();
      if (!alive || !host.current) return;
      if (!flat && town.grid) {
        const { Town3D } = await import("@/world3d/Town3D");
        if (!alive || !host.current) return;
        created = await Town3D.create(host.current, getGameStore(), callbacks, town);
      } else {
        const { GameMap } = await import("@/world/GameMap");
        if (!alive || !host.current) return;
        created = await GameMap.create(host.current, getGameStore(), callbacks, world ?? undefined);
      }
      if (!alive) return created.destroy();
      map.current = created;
      setReady(true);
      cbs.current.onReady?.(created);
    })();
    return () => {
      alive = false;
      created?.destroy();
      map.current = null;
      setReady(false);
    };
  }, [world]);

  useEffect(() => {
    map.current?.setActive(active);
  }, [active]);

  return (
    <>
      <div ref={host} className="absolute inset-0" aria-label="Town map" role="img" />
      <Loader key={world?.id ?? "town"} done={ready} />
    </>
  );
}
