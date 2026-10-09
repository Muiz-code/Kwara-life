"use client";
// The house you are inspecting, in 3D: the same flat you would live in (home.ts, furnished the way the place
// comes) and the compound outside (compound.ts). The camera glides to each stop on the tour, inside and out,
// and drifts a little while you read what the agent says. If the phone can't draw 3D, onFail tells the
// inspection to fall back to the text card.
import { useEffect, useRef } from "react";
import type { HouseModel } from "@/data/shops";
import type { TourStop } from "@/data/sync";

type V3 = [number, number, number];

/** Where the camera stands and what it looks at for each stop, and whether that stop is outside. */
export function viewFor(stop: TourStop, marks: { gen: V3 | null; pool: V3 | null }): { cam: V3; at: V3; outside: boolean } {
  const r = stop.room.toLowerCase();
  if (r.includes("generator") && marks.gen) return { cam: [5, 4.5, -14], at: marks.gen, outside: true };
  if (r.includes("compound")) return marks.pool ? { cam: [-6, 15, -30], at: [4, 0, -3], outside: true } : { cam: [0, 13, -30], at: [0, 0, -6], outside: true };
  if (r.includes("bed")) return { cam: [-0.6, 8, 3.6], at: [-3.5, 0.3, -2.8], outside: false };
  if (r.includes("kitchen")) return { cam: [1.2, 4.6, 8], at: [-4.4, 0.8, 2.3], outside: false };
  if (r.includes("toilet") || r.includes("bath")) return { cam: [2.2, 8.2, 1.8], at: [4.9, 0.3, -3.4], outside: false };
  if (r === "the room") return { cam: [8, 11, 11], at: [0, 0, 0], outside: false };
  return { cam: [9.5, 5.5, 8.5], at: [3.4, 0.6, 1.2], outside: false };
}

/** Class the place is furnished for, from how grand it is. */
const classFor = (tier: number) => (tier >= 3 ? "rich" : tier === 2 ? "middle" : "poor");

export default function HouseView3D({ house, stops, stop, onFail }: { house: HouseModel; stops: TourStop[]; stop: number; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const goTo = useRef<(i: number) => void>(() => {});
  const fail = useRef(onFail);
  const current = useRef(stop);
  useEffect(() => {
    fail.current = onFail;
    current.current = stop;
  }, [onFail, stop]);

  useEffect(() => {
    let stopAll = () => {};
    let alive = true;
    (async () => {
      try {
        const THREE = await import("three");
        const { Kit } = await import("@/world3d/kit");
        const { furnish } = await import("@/world3d/interior");
        const { buildCompound } = await import("@/world3d/compound");
        const el = host.current;
        if (!alive || !el) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        el.appendChild(renderer.domElement);
        renderer.domElement.style.display = "block";
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);

        const notes = stops.map((s) => s.note.toLowerCase());
        const said = (word: string) => stops.some((s, i) => !s.good && notes[i].includes(word));
        const cls = classFor(house.tier);

        // Inside: the flat as it comes, with the wahala the agent admitted to.
        const inKit = new Kit();
        furnish(inKit, "home", { furniture: [], tv: cls === "rich", radio: false, cls, style: null });
        if (said("leak")) {
          inKit.box(1.3, 0.8, 0.03, 4.9, 2.45, -1.9, "#6B5A45"); // the damp patch high on the wall behind the TV
          inKit.cyl(0.24, 0.18, 0.4, 5.6, 0, -0.9, "#2B7FB8", 12); // and the bucket under the drip
        }
        if (said("crack")) for (let i = 0; i < 6; i++) inKit.box(0.05, 0.4, 0.03, -5.98 + 0.01 * i, 0.9 + i * 0.35, 3.8 + (i % 2 ? 0.12 : -0.12), "#3A2A1E");
        const inside = new THREE.Mesh(inKit.merge() ?? new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
        scene.add(inside);

        // Outside: the house, the compound and the extras.
        const outKit = new Kit();
        const marks = buildCompound(outKit, house, { gutter: said("gutter") });
        const outside = new THREE.Mesh(outKit.merge() ?? new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
        outside.visible = false;
        scene.add(outside);

        scene.add(new THREE.HemisphereLight("#FFF6E4", "#4A3A2A", 1.7));
        scene.add(new THREE.AmbientLight("#ffffff", 0.35));
        const sun = new THREE.DirectionalLight("#FFE2B8", 1.5);
        sun.position.set(-8, 14, -10);
        scene.add(sun);
        const bulb = new THREE.PointLight("#FFE4B0", 6, 14, 1.6);
        bulb.position.set(1.5, 3, -1);
        scene.add(bulb);

        const size = () => {
          const w = el.clientWidth;
          const h = el.clientHeight;
          renderer.setSize(w, h);
          camera.aspect = w / h;
          // A narrow phone needs a wider view to see the whole room.
          camera.fov = w < h ? 62 : 45;
          camera.updateProjectionMatrix();
        };
        size();
        const ro = new ResizeObserver(size);
        ro.observe(el);

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const from = { cam: new THREE.Vector3(14, 16, 18), at: new THREE.Vector3(0, 0, 0) };
        const to = { cam: new THREE.Vector3(), at: new THREE.Vector3() };
        const look = new THREE.Vector3();
        let t0 = performance.now();
        let swapAt = -1;
        let outsideNext = false;
        const MOVE = reduce ? 1 : 1600;
        goTo.current = (i: number) => {
          const v = viewFor(stops[i], marks);
          // Start from wherever the camera is now.
          from.cam.copy(camera.position);
          from.at.copy(look);
          to.cam.set(...v.cam);
          to.at.set(...v.at);
          t0 = performance.now();
          // Going in or out of the front door: switch scenes halfway through the move.
          outsideNext = v.outside;
          swapAt = outside.visible !== v.outside ? t0 + MOVE / 2 : -1;
          scene.background = new THREE.Color(outside.visible ? "#BFD8E6" : "#2A2F45");
        };
        camera.position.copy(from.cam);
        look.copy(from.at);
        goTo.current(current.current);

        renderer.setAnimationLoop((now: number) => {
          if (swapAt > 0 && now >= swapAt) {
            outside.visible = outsideNext;
            inside.visible = !outsideNext;
            scene.background = new THREE.Color(outsideNext ? "#BFD8E6" : "#2A2F45");
            swapAt = -1;
          }
          const k = Math.min(1, (now - t0) / MOVE);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          camera.position.lerpVectors(from.cam, to.cam, e);
          look.lerpVectors(from.at, to.at, e);
          // Once there, drift a little, as if you were turning your head.
          if (k >= 1 && !reduce) {
            const s = (now - t0) / 1000;
            camera.position.x += Math.sin(s * 0.35) * 0.35;
            camera.position.y += Math.sin(s * 0.27) * 0.12;
          }
          camera.lookAt(look);
          renderer.render(scene, camera);
        });
        stopAll = () => {
          renderer.setAnimationLoop(null);
          ro.disconnect();
          inside.geometry.dispose();
          outside.geometry.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        if (alive) fail.current();
      }
    })();
    return () => {
      alive = false;
      stopAll();
    };
  }, [house, stops]);

  useEffect(() => {
    goTo.current(stop);
  }, [stop]);

  return <div ref={host} className="absolute inset-0" role="img" aria-label={`Inside the ${house.name.toLowerCase()}: ${stops[stop]?.room ?? ""}`} />;
}
