"use client";
// A turning 3D preview of the citizen being created, dressed for their state.
import { useEffect, useRef } from "react";
import type { Attire } from "@/data/attire";
import type { Gender } from "@/data/character";

export default function Preview3D({ g, skin, cloth, attire }: { g: Gender; skin: string; cloth: string; attire: Attire }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stop = () => {};
    let alive = true;
    (async () => {
      const THREE = await import("three");
      const { Character } = await import("@/world3d/character");
      const el = host.current;
      if (!alive || !el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
      camera.position.set(0, 1.25, 4.6);
      camera.lookAt(0, 1.0, 0);
      scene.add(new THREE.HemisphereLight("#FFF6E4", "#8A7556", 2.2));
      const sun = new THREE.DirectionalLight("#FFF1D6", 2.0);
      sun.position.set(2, 4, 3);
      scene.add(sun);
      let c: { root: import("three").Object3D; update: (dt: number, speed: number) => void; dispose: () => void } = new Character({ g, skin, cloth }, attire);
      scene.add(c.root);
      // The real person replaces the drawn one as soon as the models have loaded.
      Promise.all([import("@/world3d/avatar"), import("three/examples/jsm/utils/SkeletonUtils.js")])
        .then(async ([{ Avatar, loadPeople }, { clone }]) => {
          const people = await loadPeople();
          if (!alive) return;
          scene.remove(c.root);
          c.dispose();
          c = new Avatar(people, { g, skin, cloth }, attire, clone);
          scene.add(c.root);
        })
        .catch(() => {});
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.18 }));
      shadow.rotation.x = -Math.PI / 2;
      scene.add(shadow);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let last = performance.now();
      renderer.setAnimationLoop((now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!reduce) c.root.rotation.y += dt * 0.6;
        // A few steps, then stand, then a few more.
        c.update(dt, !reduce && Math.sin(now / 1800) > 0.3 ? 3 : 0);
        renderer.render(scene, camera);
      });
      stop = () => {
        renderer.setAnimationLoop(null);
        c.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [g, skin, cloth, attire]);
  return <div ref={host} className="h-56 w-full" aria-label={`Preview: ${attire.label}`} role="img" />;
}
