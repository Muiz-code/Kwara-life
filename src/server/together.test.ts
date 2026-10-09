import { describe, expect, it } from "vitest";
import { INVITE_LIMITS, type EmoteId } from "../data/together";
import type { Invite, Player } from "../sim/together";
import { answer, block, emote, here, inbox, invite, presence, report, settings, type InviteRow, type TogetherDb, type TogetherRow } from "./together";

/** Playing together's database in memory. */
function memoryDb(money: Record<string, number> = {}) {
  const players = new Map<string, TogetherRow>();
  const invites: InviteRow[] = [];
  const delivered = new Set<string>();
  const blocks: [string, string][] = [];
  const reports: [string, string, string][] = [];
  const reacts: { id: number; from_user: string; nickname: string; emote: EmoteId; at: number; lga: string; place: string }[] = [];
  let clock = 0;
  const db: TogetherDb & { clock: (t: number) => void; reports: typeof reports } = {
    clock: (t) => (clock = t),
    reports,
    async hereNow(user, lga, place, kind, busy) {
      const had = players.get(user);
      players.set(user, {
        user_id: user, citizen_id: had?.citizen_id ?? `${(players.size + 1).toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`, nickname: user.toUpperCase(),
        look: { g: "m", skin: "#8D5524", cloth: "#2F7D7A" }, lga_code: lga, place_id: place, place_kind: kind, busy,
        open_invites: had?.open_invites ?? false, open_dates: had?.open_dates ?? false, seen_at: clock,
      });
    },
    me: async (u) => players.get(u) ?? null,
    byCitizen: async (c) => [...players.values()].find((p) => p.citizen_id === c) ?? null,
    at: async (lga, place, since) => [...players.values()].filter((p) => p.lga_code === lga && p.place_id === place && p.seen_at >= since),
    blocks: async (u) => new Set(blocks.flatMap(([a, b]) => (a === u ? [b] : b === u ? [a] : []))),
    async setSwitches(u, i, d) {
      Object.assign(players.get(u)!, { open_invites: i, open_dates: d });
    },
    sentSince: async (u, since) => invites.filter((i) => i.from_user === u && i.sent_at >= since),
    money: async (u) => money[u] ?? 0,
    async addInvite(inv) {
      const row = { ...inv, id: `00000000-0000-0000-0000-${String(invites.length).padStart(12, "0")}`, answered_at: null, accepted: null };
      invites.push(row);
      return row;
    },
    waitingFor: async (u, since) => invites.filter((i) => i.to_user === u && i.answered_at === null && i.sent_at >= since),
    async takeAnswers(u) {
      const out = invites.filter((i) => i.from_user === u && i.answered_at !== null && !delivered.has(i.id));
      out.forEach((i) => delivered.add(i.id));
      return out;
    },
    invite: async (id) => invites.find((i) => i.id === id) ?? null,
    async answer(id, accepted) {
      const i = invites.find((x) => x.id === id);
      if (!i || i.answered_at !== null) return false;
      Object.assign(i, { answered_at: clock, accepted });
      return true;
    },
    reactions: async (lga, place, since) => reacts.filter((r) => r.lga === lga && r.place === place && r.at >= since),
    lastReaction: async (u) => reacts.filter((r) => r.from_user === u).at(-1)?.at ?? null,
    async react(u, nickname, lga, place, e) {
      reacts.push({ id: reacts.length, from_user: u, nickname, emote: e, at: clock, lga, place });
    },
    async block(u, other) {
      blocks.push([u, other]);
    },
    async report(u, other, reason) {
      reports.push([u, other, reason]);
    },
  };
  return db;
}

// 2pm WAT on a weekday: lunch at the buka is on.
const NOON = Date.parse("2026-10-20T14:00:00+01:00");
const at = (db: ReturnType<typeof memoryDb>, user: string, place = "amala", kind = "buka", t = NOON) => {
  db.clock(t);
  return presence(db, user, { lgaCode: "kwara/ilorin-west", placeId: place, placeKind: kind, busy: false });
};
const players = async (db: TogetherDb, user: string, now = NOON) => (await here(db, user, now)).body.players as Player[];
const cid = async (db: TogetherDb, user: string) => (await db.me(user))!.citizen_id;

describe("playing together on the server", () => {
  it("shows who else is at your place, never you, and drops people who left", async () => {
    const db = memoryDb();
    await at(db, "ada");
    await at(db, "bayo");
    await at(db, "chi", "mall", "mall");
    expect((await players(db, "ada")).map((p) => p.nickname)).toEqual(["BAYO"]);
    expect(await players(db, "ada", NOON + 5 * 60_000)).toEqual([]);
    expect((await presence(db, "ada", { lgaCode: "nowhere", placeId: "amala" })).status).toBe(400);
  });

  it("invites only those open to it, checks the money, and keeps one waiting invite each", async () => {
    const db = memoryDb({ ada: 10_000 });
    await at(db, "ada");
    await at(db, "bayo");
    const to = await cid(db, "bayo");
    expect((await invite(db, "ada", { to, activity: "buka" }, NOON)).body.error).toBe("BAYO is not taking invites");
    await settings(db, "bayo", { openInvites: true, openDates: false });
    expect((await invite(db, "ada", { to, activity: "date" }, NOON)).body.error).toBe("Switch on Open to dates first");
    expect((await invite(db, "ada", { to, activity: "match" }, NOON)).body.error).toBe("You can't do that here");
    const sent = await invite(db, "ada", { to, activity: "buka" }, NOON);
    expect((sent.body.invite as Invite).from.nickname).toBe("ADA");
    expect((await invite(db, "ada", { to, activity: "buka" }, NOON)).body.error).toMatch(/already invited/);
    // Not enough money to pay for both.
    await at(db, "chi");
    await settings(db, "chi", { openInvites: true, openDates: false });
    expect((await invite(db, "bayo", { to: await cid(db, "chi"), activity: "buka" }, NOON)).body.error).toMatch(/enough money/);
  });

  it("passes invites and answers once each, and lets invites lapse", async () => {
    const db = memoryDb({ ada: 10_000 });
    await at(db, "ada");
    await at(db, "bayo");
    await settings(db, "bayo", { openInvites: true, openDates: false });
    const inv = (await invite(db, "ada", { to: await cid(db, "bayo"), activity: "buka" }, NOON)).body.invite as Invite;
    const box = await inbox(db, "bayo", NOON + 5000);
    expect((box.body.invites as Invite[]).map((i) => i.id)).toEqual([inv.id]);
    expect((await answer(db, "ada", { inviteId: inv.id, accept: true }, NOON)).status).toBe(404);
    expect((await answer(db, "bayo", { inviteId: inv.id, accept: true }, NOON + 6000)).status).toBe(200);
    expect((await inbox(db, "ada", NOON + 7000)).body.answers).toEqual([{ inviteId: inv.id, accepted: true }]);
    expect((await inbox(db, "ada", NOON + 8000)).body.answers).toEqual([]);
    // A later invite nobody answers in time can't be accepted.
    const late = (await invite(db, "ada", { to: await cid(db, "bayo"), activity: "buka" }, NOON + 10_000)).body.invite as Invite;
    expect((await answer(db, "bayo", { inviteId: late.id, accept: true }, NOON + 10_000 + INVITE_LIMITS.expireS * 1000 + 1)).body.error).toMatch(/lapsed/);
  });

  it("stops inviting after three Not today, and after ten invites in an hour", async () => {
    const db = memoryDb({ ada: 1_000_000 });
    await at(db, "ada");
    await at(db, "bayo");
    await settings(db, "bayo", { openInvites: true, openDates: false });
    const to = await cid(db, "bayo");
    for (let k = 0; k < 3; k++) {
      const inv = (await invite(db, "ada", { to, activity: "buka" }, NOON + k * 1000)).body.invite as Invite;
      db.clock(NOON + k * 1000);
      await answer(db, "bayo", { inviteId: inv.id, accept: false }, NOON + k * 1000);
    }
    expect((await invite(db, "ada", { to, activity: "buka" }, NOON + 5000)).body.error).toMatch(/can't today/);
    // Ten invites to ten other people in the hour, then a rest.
    for (let k = 0; k < 7; k++) {
      await at(db, `p${k}`);
      await settings(db, `p${k}`, { openInvites: true, openDates: false });
      expect((await invite(db, "ada", { to: await cid(db, `p${k}`), activity: "buka" }, NOON)).status).toBe(200);
    }
    await at(db, "last");
    await settings(db, "last", { openInvites: true, openDates: false });
    expect((await invite(db, "ada", { to: await cid(db, "last"), activity: "buka" }, NOON)).body.error).toMatch(/plenty of invites/);
  });

  it("blocks hide both ways and stop invites; reports take a fixed reason", async () => {
    const db = memoryDb({ ada: 10_000 });
    await at(db, "ada");
    await at(db, "bayo");
    await settings(db, "bayo", { openInvites: true, openDates: false });
    await block(db, "bayo", { player: await cid(db, "ada") });
    expect(await players(db, "ada")).toEqual([]);
    expect(await players(db, "bayo")).toEqual([]);
    expect((await invite(db, "ada", { to: await cid(db, "bayo"), activity: "buka" }, NOON)).body.error).toBe("You can't invite this player");
    expect((await report(db, "ada", { player: await cid(db, "bayo"), reason: "you are a fool" })).status).toBe(400);
    expect((await report(db, "ada", { player: await cid(db, "bayo"), reason: "Too many invites" })).status).toBe(200);
    expect(db.reports).toHaveLength(1);
  });

  it("shares reactions with the place, one every few seconds", async () => {
    const db = memoryDb();
    await at(db, "ada");
    await at(db, "bayo");
    expect((await emote(db, "ada", { emote: "wave" }, NOON)).status).toBe(200);
    expect((await emote(db, "ada", { emote: "clap" }, NOON + 1000)).status).toBe(429);
    expect((await emote(db, "ada", { emote: "shout" }, NOON + 9000)).status).toBe(400);
    const r = (await inbox(db, "bayo", NOON + 2000)).body.reactions as { from: string; emote: string }[];
    expect(r.map((x) => `${x.from} ${x.emote}`)).toEqual(["ADA wave"]);
    expect((await inbox(db, "ada", NOON + 2000)).body.reactions).toEqual([]);
  });
});
