# Kwara Life
Sims-style life game set in real Ilorin, Kwara State. Inspired by Lagos Life.

## Reference
- reference/kwara-life.html is the working prototype. Port its logic, data and balance
  (places, actions, needs, transport, estates, job, goals, interiors). Do not copy its
  single-file structure.
- reference/assets.txt lists Higgsfield image URLs with labels.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- PixiJS + pixi-viewport for the world map (pan, zoom, sprites, camera follow)
- React for UI panels (needs, place panel, transport picker, modals)
- Zustand for game state, saved to localStorage for now
- Supabase later for accounts, cloud saves, friends and multiplayer

## Structure
- src/game/data: locations.ts, roads.ts, actions.ts, friends.ts (pure data)
- src/game/sim: time, needs decay, actions, travel, events (pure functions, unit tested)
- src/game/map: Pixi world, roads, buildings, vehicles, camera
- src/game/scenes: interiors with tappable hotspots
- src/components: React UI
- public/assets: images (WebP). scripts/cutout.py removes the cream backgrounds.

## Rules
- Real Ilorin places and coordinates. No invented landmarks without asking.
- Nigerian English and Yoruba flavour in copy. No em dashes anywhere.
- Mobile first. Must run smoothly on a mid-range Android phone.
- Work in phases. Show a plan first, wait for approval, commit after each working phase.

## Image style (for new Higgsfield generations)
Soft clay 3D render, warm harmattan afternoon light, isometric diorama on a small
square ground base, plain flat cream background (#F3EBDD), no text, no logos.
Interiors: three-quarter elevated view, clear floor in the foreground.
