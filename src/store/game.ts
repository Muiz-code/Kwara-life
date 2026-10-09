import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import type { Character } from "../data/character";
import { PLACE } from "../data/ilorin/places";
import {
  advance, checkCritical, clone, finishAction, finishTrip, freshState, log, note, resolveChoice,
  pvcReminders, sanitizeGame, startAction, startTrip, tripTiming, tripTotalMs, rollCitizen, castVote, postSupportCard, buyPromo, applyForJob,
  buyVotes as buyVotesSim, type Ballot, type CardInput, type PromoInput, type BribeInput, type Opening, startingMoney, takeJourney, airportTown, currentLga, handoverSeconds, type JourneyMode, type ActionFlow, type ActionPlan, type ChoiceId, type GameState, type Rng, type Trip, type TripTiming,
} from "../sim";
import { clockNow } from "./clock";
import { HUSTLE } from "../data/hustles";
import { isHomeStyle, type HomeStyle } from "../data/homestyle";
import { phoneOf } from "../data/phones";
import { EDUCATION_RANK } from "../data/careers";
import { answerCall as answerCallSim, sitInterview as sitInterviewSim } from "../sim/interview";
import { sealedStorage } from "./seal";
import { throttledStorage } from "./storage";
import { findActionAt, placeInfo, tripWorldFor } from "./world";
import type { WorldMap } from "../world";
import type { Look } from "../data/character";
import { PRESIDENTIAL_2027, seasonClosed } from "../data/calendar";
import { LGA } from "../data/geography";
import { bankOp, book, freshBank, reconcile, type BankOp } from "../sim/bank";
import { STATE } from "../data/states";

export const SAVE_KEY = "kwara-life-v4";
/** Game minutes that pass each real second while idle. */
export const MINUTES_PER_TICK = 2;

/** Something that takes real time to play out: an action or a trip. */
export type Activity =
  | { kind: "action"; plan: ActionPlan; startedAt: number; ms: number; done: number }
  | { kind: "trip"; trip: Trip; startedAt: number; ms: number; done: number; timing: TripTiming; fast?: boolean };

export interface GameStore {
  game: GameState;
  /** Place shown in the side panel. */
  selected: string;
  paused: boolean;
  activity: Activity | null;
  /** Toasts waiting to be shown, oldest first. */
  toasts: string[];
  /** Counts toasts shown and gone, so two identical toasts in a row each get their own timer. */
  toastSeq: number;
  reducedMotion: boolean;
  /** A screen an action opened (ballot, vote-buying offer, flyers), or null. */
  flow: ActionFlow | null;
  /** The map of the LGA the citizen is in. Null until loaded (the Ilorin map is the fallback). */
  world: WorldMap | null;
  /** Long-journey loading screen: real time it ends, and where to. */
  journey: { until: number; to: string; seconds: number } | null;

  /** Once a second: idle clock. */
  tick: () => void;
  /** Every animation frame while an activity runs. now is performance.now(). */
  progress: (now: number) => void;
  select: (id: string) => void;
  doAction: (actionId: string, now: number) => void;
  /** Do a side hustle from the phone's Hustle app, wherever you are. Returns a reason if you can't. */
  doHustle: (id: string, now: number) => string | null;
  /** Restyle your home: walls, floor, sofa and accent colour. Free. */
  setHomeStyle: (style: HomeStyle) => void;
  /** A Klario banking operation; returns why it failed, or null. */
  banking: (op: BankOp) => string | null;
  /** Answer or decline the recruiter's call. */
  answerCall: (accept: boolean) => void;
  /** Sit the booked interview with an answer per question. */
  sitInterview: (answers: number[]) => { hired: boolean; score: number } | string;
  travel: (dest: string, mode: string, now: number) => void;
  /** Fast-forward a trip: the rest plays out in about two seconds. Same fare, same game time. */
  skipTrip: (now: number) => void;
  /**
   * The player walked to a place on foot (free roam in 3D): the walk's time, tiredness and anything on
   * the way happen at once, under the same rules as a walking trip. Returns a reason if they can't go in.
   */
  arrive: (dest: string) => string | null;
  /** Answer the note at the front of the queue. */
  answer: (choice: ChoiceId) => void;
  setInside: (inside: boolean) => void;
  setCharacter: (c: Character) => void;
  togglePause: () => void;
  setReducedMotion: (v: boolean) => void;
  shiftToast: () => void;
  closeFlow: () => void;
  setWorld: (map: WorldMap) => void;
  /** Roll a new citizen from the player's picks (name, look, state, LGA). */
  createCitizen: (input: { name: string; look: Look; stateCode: string; lgaCode: string }) => string | null;
  /** Travel to another LGA or state. Returns a reason if blocked. */
  journeyTo: (lgaCode: string, mode: JourneyMode) => string | null;
  endJourney: () => void;
  /** Ballot cast this session, kept only in memory so the player sees "includes your vote". Never saved. */
  myBallot: Ballot | null;
  vote: (party: string) => string | null;
  postCard: (input: CardInput) => string | null;
  promote: (input: PromoInput) => string | null;
  buyVotes: (input: BribeInput) => string | null;
  applyJob: (opening: Pick<Opening, "id">) => string | null;
  reset: () => void;
}

export const isBusy = (s: GameStore) => s.activity !== null;
/** A note is open, or the player hasn't made a character yet. */
export const isModalOpen = (s: GameStore) => s.game.notes.length > 0 || !s.game.char;

/** Real-time length of an action's animation, as in the prototype. */
/** How long the rest of a fast-forwarded trip takes on screen. */
export const FAST_FORWARD_MS = 2200;

export const actionAnimMs = (dur: number) => Math.min(1800, 500 + dur * 2.2);

export interface StoreOptions {
  rng?: Rng;
  storage?: StateStorage;
  /** Real wall-clock time in ms, for the election calendar. */
  realNow?: () => number;
  /** Where the save lives: one per signed-in account (see store/index.ts). */
  saveKey?: string;
}

export function createGameStore({ rng = Math.random, storage, realNow = clockNow, saveKey = SAVE_KEY }: StoreOptions = {}) {
  // Saves are sealed: one edited in DevTools fails its signature and the game starts fresh.
  const persistStorage = sealedStorage(
    storage ?? throttledStorage(typeof window !== "undefined" ? window.localStorage : undefined),
  );

  return createStore<GameStore>()(
    persist(
      (set, get) => {
        /** Save a new game state, moving its toasts onto the toast queue. */
        const commit = (game: GameState, extra: Partial<GameStore> = {}) => {
          // Last line of defence: a state with broken money (NaN makes every price check pass) is never kept.
          if (!Number.isFinite(game.money)) return;
          // Every wallet change goes on the Klario statement, labelled where it happened or as "Other".
          const prev = get().game.citizen;
          game = reconcile(get().game, game);
          // A new home (a house bought, a shelter bed) or a new class changes the town: build it again.
          const c = game.citizen;
          if (prev && c && (c.home !== prev.home || c.underFlyover !== prev.underFlyover || c.cls !== prev.cls)) extra = { ...extra, world: null };
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
          toastSeq: 0,
          reducedMotion: false,
          flow: null,
          world: null,
          journey: null,
          myBallot: null,

          tick: () => {
            const st = get();
            if (st.paused || isBusy(st) || isModalOpen(st)) return;
            // The season is over: the game is frozen for everyone.
            if (st.game.citizen && seasonClosed(PRESIDENTIAL_2027, realNow())) return;
            const g = clone(st.game);
            advance(g, MINUTES_PER_TICK, rng);
            checkCritical(g, rng);
            pvcReminders(g, realNow());
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
              const done = finishAction(g, a.plan, rng, { now: realNow(), place: placeInfo(st.world, g.loc) });
              commit(done, { activity: null, selected: done.loc });
            } else {
              const done = finishTrip(g, a.trip, rng);
              commit(done, { activity: null, selected: done.loc });
            }
          },

          select: (id) => {
            const st = get();
            const known = st.world ? st.world.places.some((p) => p.id === id) : !!PLACE[id];
            if (!known) return;
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
            const a = findActionAt(st.game, st.world, st.game.loc, actionId);
            if (!a) return;
            // A real journey to another state, through the same rules as the journey screen.
            if (a.journey) {
              const to = a.journey.mode === "flight" ? airportTown(a.journey.state) : undefined;
              if (!to) return toast("No flights to there");
              const why = get().journeyTo(to, a.journey.mode);
              if (why) return toast(why);
              if (a.journey.state === "lagos" && a.journey.mode === "flight") set({ game: { ...get().game, goals: { ...get().game.goals, fly: true } } });
              return;
            }
            const ctx = { now: realNow(), place: placeInfo(st.world, st.game.loc) };
            const r = startAction(st.game, a, rng, ctx);
            if ("blocked" in r) return toast(r.blocked);
            if ("flow" in r) return set({ flow: r.flow });
            const ms = st.reducedMotion ? 120 : actionAnimMs(r.plan.dur);
            commit(r.state, { activity: { kind: "action", plan: r.plan, startedAt: now, ms, done: 0 } });
          },

          doHustle: (id, now) => {
            const st = get();
            if (isBusy(st)) return "You are busy";
            const h = HUSTLE[id];
            if (!h) return "That gig is gone";
            const c = st.game.citizen;
            if (!c) return "Create your citizen first";
            if (h.phones && !h.phones.includes(phoneOf(st.game.phone, c.cls).kind)) return "You need a smartphone for this gig";
            if (h.minEducation && EDUCATION_RANK[c.education] < EDUCATION_RANK[h.minEducation]) return "You need more schooling for this gig";
            // Gigs run on their own clock, not a place's opening hours.
            const ctx = { now: realNow(), place: { name: "your hustle", open: [0, 24] as [number, number], gen: true } };
            const r = startAction(st.game, h, rng, ctx);
            if ("blocked" in r) return r.blocked;
            if ("flow" in r) return null;
            const ms = st.reducedMotion ? 120 : actionAnimMs(r.plan.dur);
            commit(r.state, { activity: { kind: "action", plan: r.plan, startedAt: now, ms, done: 0 } });
            return null;
          },

          answerCall: (accept) => commit(answerCallSim(get().game, accept)),

          banking: (op) => {
            const r = bankOp(get().game, op);
            if ("error" in r) return r.error;
            commit(r.state);
            return null;
          },
          setHomeStyle: (style) => {
            if (isHomeStyle(style)) set({ game: { ...get().game, homeStyle: { ...style } } });
          },

          sitInterview: (answers) => {
            const r = sitInterviewSim(get().game, answers, rng);
            if ("blocked" in r) return r.blocked;
            commit(r.state);
            return { hired: r.hired, score: r.score };
          },

          travel: (dest, mode, now) => {
            const st = get();
            if (isBusy(st)) return;
            const r = startTrip(st.game, dest, mode, realNow(), tripWorldFor(st.game, st.world));
            if ("blocked" in r) return toast(r.blocked);
            const timing = st.reducedMotion ? { wait: 0, board: 0, ride: 400, alight: 0 } : tripTiming(mode, r.trip.route.length);
            commit(r.state, { activity: { kind: "trip", trip: r.trip, startedAt: now, ms: tripTotalMs(timing), done: 0, timing } });
          },

          skipTrip: (now) => {
            const a = get().activity;
            if (a?.kind !== "trip" || a.fast) return;
            // Stretch time so the rest of the trip plays in FAST_FORWARD_MS: every phase keeps its share,
            // and you still see the vehicle go the whole way.
            const p = Math.min(0.999, Math.max(0, (now - a.startedAt) / a.ms));
            const left = a.ms * (1 - p);
            if (left <= FAST_FORWARD_MS) return;
            const ms = FAST_FORWARD_MS / (1 - p);
            const k = ms / a.ms;
            const t = a.timing;
            const timing = { wait: t.wait * k, board: t.board * k, ride: t.ride * k, alight: t.alight * k };
            set({ activity: { ...a, ms, startedAt: now - p * ms, timing, fast: true } });
          },

          arrive: (dest) => {
            const st = get();
            if (isBusy(st) || isModalOpen(st)) return "Wait a moment";
            if (dest === st.game.loc) return null;
            const r = startTrip(st.game, dest, "walk", realNow(), tripWorldFor(st.game, st.world), true);
            if ("blocked" in r) return r.blocked;
            const g = clone(r.state);
            advance(g, r.trip.minutes, rng);
            const done = finishTrip(g, r.trip, rng);
            checkCritical(done, rng);
            commit(done, { selected: done.loc });
            return null;
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
          setWorld: (map) => set({ world: map }),
          createCitizen: (input) => {
            const st = get();
            try {
              const now = realNow();
              const citizen = rollCitizen(input, now, rng);
              const g = clone(st.game);
              g.citizen = citizen;
              g.char = { name: citizen.name, ...citizen.look };
              g.money = 0;
              g.bank = freshBank();
              g.visited = [citizen.stateCode];
              book(g, startingMoney(citizen, rng), "Opening balance", "opening");
              g.loc = "home";
              g.homeId = "home";
              g.at = null;
              const lga = LGA[citizen.lgaCode];
              log(g, `${citizen.name} started life in ${lga.name}, ${STATE[lga.stateCode].name}.`);
              commit(g, { selected: "home", world: null });
              return null;
            } catch (e) {
              return (e as Error).message;
            }
          },
          journeyTo: (lgaCode, mode) => {
            const st = get();
            if (isBusy(st) || st.journey) return "Wait a moment";
            const from = currentLga(st.game);
            const r = takeJourney(st.game, lgaCode, mode, realNow(), rng);
            if ("blocked" in r) return r.blocked;
            const seconds = from ? handoverSeconds(from, lgaCode) : 0;
            commit(r, { world: null, selected: r.loc, journey: { until: realNow() + seconds * 1000, to: lgaCode, seconds } });
            return null;
          },
          endJourney: () => set({ journey: null }),
          vote: (party) => {
            const st = get();
            const r = castVote(st.game, party, { now: realNow(), atPollingUnit: st.game.loc === "pu" }, rng);
            if ("blocked" in r) return r.blocked;
            commit(r.state, { myBallot: r.ballot, flow: null });
            return null;
          },
          postCard: (input) => {
            const r = postSupportCard(get().game, input, { now: realNow() });
            if ("blocked" in r) return r.blocked;
            commit(r);
            return null;
          },
          promote: (input) => {
            const r = buyPromo(get().game, input, { now: realNow() });
            if ("blocked" in r) return r.blocked;
            commit(r.state, { flow: null });
            return null;
          },
          buyVotes: (input) => {
            const r = buyVotesSim(get().game, input, { now: realNow() }, rng);
            if ("blocked" in r) return r.blocked;
            commit(r.state, { flow: null });
            return null;
          },
          applyJob: (opening) => {
            const r = applyForJob(get().game, opening, rng);
            if ("blocked" in r) return r.blocked;
            commit(r);
            return null;
          },
          shiftToast: () => set({ toasts: get().toasts.slice(1), toastSeq: get().toastSeq + 1 }),
          reset: () => {
            const g = freshState();
            set({ game: g, selected: g.loc, activity: null, toasts: [], paused: false, flow: null, journey: null, myBallot: null, world: null });
          },
        };
      },
      {
        name: saveKey,
        version: 1,
        storage: createJSONStorage(() => persistStorage),
        // Only the game is saved. If the page closes mid-activity, the time already
        // spent is kept but the activity itself is dropped, as in the prototype.
        partialize: (s) => ({ game: { ...s.game, toasts: [] } }),
        merge: (persisted, current) => {
          // Fields added after the save was made get their defaults; impossible values reject the save.
          const game = sanitizeGame((persisted as { game?: unknown } | undefined)?.game);
          if (!game) return current;
          // Legacy Ilorin saves have no citizen and must be on an Ilorin place; citizens' places come from their map.
          if (!game.citizen && (!PLACE[game.loc] || !PLACE[game.homeId])) return current;
          if (game.citizen && !LGA[game.citizen.lgaCode]) return current;
          return { ...current, game, selected: game.loc };
        },
      },
    ),
  );
}

export type GameStoreApi = ReturnType<typeof createGameStore>;
