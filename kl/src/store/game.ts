import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { findAction } from "../data/ilorin/actions";
import type { Character } from "../data/character";
import { PLACE } from "../data/ilorin/places";
import {
  advance, checkCritical, clone, finishAction, finishTrip, freshState, log, note, resolveChoice,
  startAction, startTrip, tripAnimMs, type ActionFlow, type ActionPlan, type ChoiceId, type GameState, type ModeId, type Rng, type Trip,
} from "../sim";
import { throttledStorage } from "./storage";

export const SAVE_KEY = "kwara-life-v4";
/** Game minutes that pass each real second while idle. */
export const MINUTES_PER_TICK = 2;

/** Something that takes real time to play out: an action or a trip. */
export type Activity =
  | { kind: "action"; plan: ActionPlan; startedAt: number; ms: number; done: number }
  | { kind: "trip"; trip: Trip; startedAt: number; ms: number; done: number };

export interface GameStore {
  game: GameState;
  /** Place shown in the side panel. */
  selected: string;
  paused: boolean;
  activity: Activity | null;
  /** Toasts waiting to be shown, oldest first. */
  toasts: string[];
  reducedMotion: boolean;
  /** A screen an action opened (ballot, vote-buying offer, flyers), or null. */
  flow: ActionFlow | null;

  /** Once a second: idle clock. */
  tick: () => void;
  /** Every animation frame while an activity runs. now is performance.now(). */
  progress: (now: number) => void;
  select: (id: string) => void;
  doAction: (actionId: string, now: number) => void;
  travel: (dest: string, mode: ModeId, now: number) => void;
  /** Answer the note at the front of the queue. */
  answer: (choice: ChoiceId) => void;
  setInside: (inside: boolean) => void;
  setCharacter: (c: Character) => void;
  togglePause: () => void;
  setReducedMotion: (v: boolean) => void;
  shiftToast: () => void;
  closeFlow: () => void;
  reset: () => void;
}

export const isBusy = (s: GameStore) => s.activity !== null;
/** A note is open, or the player hasn't made a character yet. */
export const isModalOpen = (s: GameStore) => s.game.notes.length > 0 || !s.game.char;

/** Real-time length of an action's animation, as in the prototype. */
export const actionAnimMs = (dur: number) => Math.min(1800, 500 + dur * 2.2);

export interface StoreOptions {
  rng?: Rng;
  storage?: StateStorage;
  /** Real wall-clock time in ms, for the election calendar. */
  realNow?: () => number;
}

export function createGameStore({ rng = Math.random, storage, realNow = Date.now }: StoreOptions = {}) {
  const persistStorage =
    storage ?? throttledStorage(typeof window !== "undefined" ? window.localStorage : undefined);

  return createStore<GameStore>()(
    persist(
      (set, get) => {
        /** Save a new game state, moving its toasts onto the toast queue. */
        const commit = (game: GameState, extra: Partial<GameStore> = {}) => {
          const toasts = game.toasts.length ? [...get().toasts, ...game.toasts] : get().toasts;
          set({ ...extra, game: game.toasts.length ? { ...game, toasts: [] } : game, toasts });
        };
        const toast = (msg: string) => set({ toasts: [...get().toasts, msg] });

        return {
          game: freshState(),
          selected: freshState().loc,
          paused: false,
          activity: null,
          toasts: [],
          reducedMotion: false,
          flow: null,

          tick: () => {
            const st = get();
            if (st.paused || isBusy(st) || isModalOpen(st)) return;
            const g = clone(st.game);
            advance(g, MINUTES_PER_TICK, rng);
            checkCritical(g, rng);
            commit(g, g.loc !== st.game.loc ? { selected: g.loc } : {});
          },

          progress: (now) => {
            const st = get();
            const a = st.activity;
            if (!a) return;
            const p = Math.min(1, Math.max(0, (now - a.startedAt) / a.ms));
            const total = a.kind === "action" ? a.plan.dur : a.trip.minutes;
            const target = Math.round(total * p);
            let g = st.game;
            if (target > a.done) {
              g = clone(g);
              advance(g, target - a.done, rng, { sleep: a.kind === "action" && a.plan.sleep });
            }
            if (p < 1) {
              if (target > a.done) commit(g, { activity: { ...a, done: target } });
              return;
            }
            if (a.kind === "action") {
              const done = finishAction(g, a.plan, rng, { now: realNow() });
              commit(done, { activity: null, selected: done.loc });
            } else {
              const done = finishTrip(g, a.trip, rng);
              commit(done, { activity: null, selected: done.loc });
            }
          },

          select: (id) => {
            const st = get();
            if (!PLACE[id]) return;
            // Tapping where you already are, twice, walks you inside.
            if (id === st.game.loc && st.selected === st.game.loc && !isBusy(st) && !st.game.inside) {
              set({ game: { ...st.game, inside: true } });
              return;
            }
            set({ selected: id });
          },

          doAction: (actionId, now) => {
            const st = get();
            if (isBusy(st)) return;
            const a = findAction(st.game.loc, actionId);
            if (!a) return;
            const r = startAction(st.game, a, rng, { now: realNow() });
            if ("blocked" in r) return toast(r.blocked);
            if ("flow" in r) return set({ flow: r.flow });
            const ms = st.reducedMotion ? 120 : actionAnimMs(r.plan.dur);
            commit(r.state, { activity: { kind: "action", plan: r.plan, startedAt: now, ms, done: 0 } });
          },

          travel: (dest, mode, now) => {
            const st = get();
            if (isBusy(st)) return;
            const r = startTrip(st.game, dest, mode);
            if ("blocked" in r) return toast(r.blocked);
            const ms = st.reducedMotion ? 400 : tripAnimMs(mode, r.trip.route.length);
            commit(r.state, { activity: { kind: "trip", trip: r.trip, startedAt: now, ms, done: 0 } });
          },

          answer: (choice) => {
            const st = get();
            if (!st.game.notes.length) return;
            const g = clone(st.game);
            g.notes.shift();
            resolveChoice(g, choice, rng);
            checkCritical(g, rng);
            commit(g);
          },

          setInside: (inside) => {
            const st = get();
            if (isBusy(st) || st.game.inside === inside) return;
            set({ game: { ...st.game, inside }, selected: st.game.loc });
          },

          setCharacter: (c) => {
            const st = get();
            const g = clone(st.game);
            const first = !g.char;
            g.char = c;
            if (first) {
              log(g, `${c.name} moved into a Tanke compound with ₦20,000 and big dreams.`);
              note(
                g,
                `Welcome to Ilorin, ${c.name}`,
                "Drag to move around the map, pinch or scroll to zoom. Tap a place, then pick how to get there: walk, keke, okada, korope bus, or a Durbar horse if you hire one. Keep your needs up, get a job at the Secretariat, move into an estate, and one day ride the long road to KWASU in Malete.",
                [{ label: "Let's go", id: "ok" }],
              );
            }
            commit(g);
          },

          togglePause: () => set({ paused: !get().paused }),
          setReducedMotion: (v) => set({ reducedMotion: v }),
          closeFlow: () => set({ flow: null }),
          shiftToast: () => set({ toasts: get().toasts.slice(1) }),
          reset: () => {
            const g = freshState();
            set({ game: g, selected: g.loc, activity: null, toasts: [], paused: false });
          },
        };
      },
      {
        name: SAVE_KEY,
        version: 1,
        storage: createJSONStorage(() => persistStorage),
        // Only the game is saved. If the page closes mid-activity, the time already
        // spent is kept but the activity itself is dropped, as in the prototype.
        partialize: (s) => ({ game: { ...s.game, toasts: [] } }),
        merge: (persisted, current) => {
          const game = (persisted as { game?: GameState } | undefined)?.game;
          if (!game || !game.needs || !PLACE[game.loc] || !PLACE[game.homeId]) return current;
          return { ...current, game: { ...freshState(), ...game, toasts: [] }, selected: game.loc };
        },
      },
    ),
  );
}

export type GameStoreApi = ReturnType<typeof createGameStore>;
