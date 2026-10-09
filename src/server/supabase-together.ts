// Playing together's database, on Supabase (supabase/migrations/*_together.sql). Server only, secret key.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmoteId } from "../data/together";
import type { InviteRow, TogetherDb, TogetherRow } from "./together";

const ms = (t: string | null) => (t ? Date.parse(t) : null);
const iso = (t: number) => new Date(t).toISOString();
const PLAYER = "user_id, citizen_id, nickname, look, lga_code, place_id, place_kind, busy, open_invites, open_dates, seen_at";
const INVITE = "id, from_user, to_user, activity, place_id, sent_at, answered_at, accepted";

const player = (r: Record<string, unknown>): TogetherRow => ({ ...(r as unknown as TogetherRow), seen_at: ms(r.seen_at as string) ?? 0 });
const invite = (r: Record<string, unknown>): InviteRow => ({
  ...(r as unknown as InviteRow),
  sent_at: ms(r.sent_at as string) ?? 0,
  answered_at: ms(r.answered_at as string | null),
});

export function supabaseTogetherDb(sb: SupabaseClient): TogetherDb {
  const must = <T,>(r: { data: T; error: unknown }) => {
    if (r.error) throw r.error;
    return r.data;
  };
  return {
    async hereNow(user, lga, place, kind, busy) {
      must(await sb.rpc("together_here_now", { p_user: user, p_lga: lga, p_place: place, p_kind: kind, p_busy: busy }));
    },
    async me(user) {
      const r = must(await sb.from("together_players").select(PLAYER).eq("user_id", user).maybeSingle());
      return r ? player(r) : null;
    },
    async byCitizen(citizenId) {
      const r = must(await sb.from("together_players").select(PLAYER).eq("citizen_id", citizenId).maybeSingle());
      return r ? player(r) : null;
    },
    async at(lga, place, since) {
      const rows = must(await sb.from("together_players").select(PLAYER).eq("lga_code", lga).eq("place_id", place).gte("seen_at", iso(since)).limit(40));
      return (rows ?? []).map(player);
    },
    async blocks(user) {
      const [mine, theirs] = await Promise.all([
        sb.from("together_blocks").select("blocked").eq("user_id", user),
        sb.from("together_blocks").select("user_id").eq("blocked", user),
      ]);
      return new Set([...(must(mine) ?? []).map((r) => r.blocked as string), ...(must(theirs) ?? []).map((r) => r.user_id as string)]);
    },
    async setSwitches(user, openInvites, openDates) {
      must(await sb.from("together_players").update({ open_invites: openInvites, open_dates: openDates }).eq("user_id", user));
    },
    async sentSince(user, since) {
      return (must(await sb.from("together_invites").select(INVITE).eq("from_user", user).gte("sent_at", iso(since))) ?? []).map(invite);
    },
    async money(user) {
      const r = must(await sb.from("game_saves").select("money:game->money").eq("user_id", user).maybeSingle());
      return Number((r as { money?: unknown } | null)?.money) || 0;
    },
    async addInvite(inv) {
      const row = must(await sb.from("together_invites").insert({ ...inv, sent_at: iso(inv.sent_at) }).select(INVITE).single());
      if (!row) throw new Error("Invite not saved");
      return invite(row);
    },
    async waitingFor(user, since) {
      const rows = must(await sb.from("together_invites").select(INVITE).eq("to_user", user).is("answered_at", null).gte("sent_at", iso(since)));
      return (rows ?? []).map(invite);
    },
    async takeAnswers(user) {
      const rows = must(await sb.from("together_invites").update({ delivered: true }).eq("from_user", user).eq("delivered", false).not("answered_at", "is", null).select(INVITE));
      return (rows ?? []).map(invite);
    },
    async invite(id) {
      const r = must(await sb.from("together_invites").select(INVITE).eq("id", id).maybeSingle());
      return r ? invite(r) : null;
    },
    async answer(id, accepted) {
      const rows = must(await sb.from("together_invites").update({ answered_at: iso(Date.now()), accepted }).eq("id", id).is("answered_at", null).select("id"));
      return (rows ?? []).length > 0;
    },
    async reactions(lga, place, since) {
      const rows = must(await sb.from("together_reactions").select("id, from_user, nickname, emote, at").eq("lga_code", lga).eq("place_id", place).gte("at", iso(since)).order("at").limit(40));
      return (rows ?? []).map((r) => ({ id: r.id as number, from_user: r.from_user as string, nickname: r.nickname as string, emote: r.emote as EmoteId, at: ms(r.at as string) ?? 0 }));
    },
    async lastReaction(user) {
      const r = must(await sb.from("together_reactions").select("at").eq("from_user", user).order("at", { ascending: false }).limit(1).maybeSingle());
      return r ? ms((r as { at: string }).at) : null;
    },
    async react(user, nickname, lga, place, emote) {
      must(await sb.from("together_reactions").insert({ from_user: user, nickname, lga_code: lga, place_id: place, emote }));
      // Keep the table small: reactions only matter for a minute.
      if (Math.random() < 0.02) await sb.from("together_reactions").delete().lt("at", iso(Date.now() - 10 * 60_000));
    },
    async block(user, other) {
      must(await sb.from("together_blocks").upsert({ user_id: user, blocked: other }, { onConflict: "user_id,blocked", ignoreDuplicates: true }));
    },
    async report(user, other, reason) {
      must(await sb.from("together_reports").insert({ reporter: user, reported: other, reason }));
    },
  };
}
