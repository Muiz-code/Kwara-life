// The admin panel's server side (docs/DECISIONS.md, "Admin panel"). Only people in public.admins get anything
// back; everyone else is told "not found", so the panel doesn't even admit it exists. The owner has every power;
// moderators see the dashboard and moderate (reports, support-card notes, sponsored news, bans). Nobody can touch
// votes or results: nothing here writes to voter_rolls or vote_tallies. Every action is written to admin_log.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanNote } from "@/sim/campaign";

export type Role = "owner" | "moderator";

/** What each role may do. */
export const CAN: Record<string, Role[]> = {
  stats: ["owner", "moderator"],
  reports: ["owner", "moderator"],
  cards: ["owner", "moderator"],
  promos: ["owner", "moderator"],
  hide: ["owner", "moderator"],
  ban: ["owner", "moderator"],
  unban: ["owner", "moderator"],
  announce: ["owner"],
  unannounce: ["owner"],
  log: ["owner"],
};

export const allowed = (role: Role, action: string) => !!CAN[action]?.includes(role);

export async function roleOf(db: SupabaseClient, user: string): Promise<Role | null> {
  const { data } = await db.from("admins").select("role").eq("user_id", user).maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

async function log(db: SupabaseClient, admin: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  await db.from("admin_log").insert({ admin_id: admin, action, target: target.slice(0, 100), detail });
}

export async function stats(db: SupabaseClient) {
  const { data, error } = await db.rpc("admin_stats");
  if (error) throw error;
  return data;
}

/** Names for a set of accounts: their citizen's game name (never an email). */
async function namesOf(db: SupabaseClient, users: string[]): Promise<Record<string, string>> {
  if (!users.length) return {};
  const { data } = await db.from("citizens").select("user_id, name").in("user_id", [...new Set(users)]);
  return Object.fromEntries((data ?? []).map((c) => [c.user_id as string, c.name as string]));
}

async function bannedOf(db: SupabaseClient, users: string[]): Promise<Set<string>> {
  if (!users.length) return new Set();
  const { data } = await db.from("bans").select("user_id").in("user_id", [...new Set(users)]);
  return new Set((data ?? []).map((b) => b.user_id as string));
}

export async function reports(db: SupabaseClient) {
  const { data, error } = await db.from("together_reports").select("id, reporter, reported, reason, at").order("at", { ascending: false }).limit(100);
  if (error) throw error;
  const users = (data ?? []).flatMap((r) => [r.reporter as string, r.reported as string]);
  const [names, banned] = await Promise.all([namesOf(db, users), bannedOf(db, users)]);
  // How many times each player has been reported, so repeat problems stand out.
  const count: Record<string, number> = {};
  for (const r of data ?? []) count[r.reported as string] = (count[r.reported as string] ?? 0) + 1;
  return (data ?? []).map((r) => ({
    id: r.id,
    reason: r.reason,
    at: r.at,
    reporter: { id: r.reporter, name: names[r.reporter as string] ?? "Unknown" },
    reported: { id: r.reported, name: names[r.reported as string] ?? "Unknown", banned: banned.has(r.reported as string), reports: count[r.reported as string] },
  }));
}

/** The latest support cards that carry a note (the only free text players can post). */
export async function cards(db: SupabaseClient) {
  const { data, error } = await db
    .from("support_cards")
    .select("id, note, party, issues, lga_code, created_at, hidden, citizens(name, user_id)")
    .neq("note", "")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { id: number; note: string; party: string; issues: string[]; lga_code: string; created_at: string; hidden: boolean; citizens: { name: string; user_id: string } | null }[];
  const banned = await bannedOf(db, rows.map((r) => r.citizens?.user_id ?? "").filter(Boolean));
  return rows.map((r) => ({ ...r, by: r.citizens?.name ?? "Unknown", user: r.citizens?.user_id ?? null, banned: !!r.citizens && banned.has(r.citizens.user_id), citizens: undefined }));
}

/** The latest sponsored news and flyers. */
export async function promos(db: SupabaseClient) {
  const { data, error } = await db
    .from("promos")
    .select("id, kind, option, party, lga_code, price, day, created_at, hidden, citizens(name, user_id)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { id: number; kind: string; option: number; party: string; lga_code: string; price: number; day: string; created_at: string; hidden: boolean; citizens: { name: string; user_id: string } | null }[];
  return rows.map((r) => ({ ...r, by: r.citizens?.name ?? "Unknown", user: r.citizens?.user_id ?? null, citizens: undefined }));
}

type Body = Record<string, unknown>;
type Out = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown> = { ok: true }): Out => ({ status: 200, body });
const bad = (error: string, status = 400): Out => ({ status, body: { error } });

export async function hide(db: SupabaseClient, admin: string, b: Body): Promise<Out> {
  const table = b.kind === "card" ? "support_cards" : b.kind === "promo" ? "promos" : null;
  const id = Number(b.id);
  if (!table || !Number.isInteger(id)) return bad("Pick something to hide");
  const hidden = b.hidden !== false;
  const { error } = await db.from(table).update({ hidden }).eq("id", id);
  if (error) return bad("Try again", 503);
  await log(db, admin, hidden ? "hide" : "unhide", `${b.kind}:${id}`);
  return ok();
}

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

export async function ban(db: SupabaseClient, admin: string, b: Body): Promise<Out> {
  if (!isUuid(b.user)) return bad("Pick a player");
  if (b.user === admin) return bad("You can't ban yourself");
  if (await roleOf(db, b.user)) return bad("Admins can't be banned. Remove their role first");
  const reason = typeof b.reason === "string" ? b.reason.slice(0, 120) : "";
  // A ban on the account: it can't sign in or refresh its session again. Their vote, if cast, still counts.
  const { error } = await db.auth.admin.updateUserById(b.user, { ban_duration: "876000h" });
  if (error) return bad("Could not ban. Try again", 503);
  await db.from("bans").upsert({ user_id: b.user, reason, by_admin: admin });
  await log(db, admin, "ban", b.user, { reason });
  return ok();
}

export async function unban(db: SupabaseClient, admin: string, b: Body): Promise<Out> {
  if (!isUuid(b.user)) return bad("Pick a player");
  const { error } = await db.auth.admin.updateUserById(b.user, { ban_duration: "none" });
  if (error) return bad("Could not lift the ban. Try again", 503);
  await db.from("bans").delete().eq("user_id", b.user);
  await log(db, admin, "unban", b.user);
  return ok();
}

/** The line at the front of every player's news ticker. Same filter as players' notes, 80 characters. */
export async function announce(db: SupabaseClient, admin: string, b: Body): Promise<Out> {
  const text = typeof b.text === "string" ? b.text.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > 80) return bad("Write 1 to 80 characters");
  if (!cleanNote(text)) return bad("That can't be posted. No links or bad words");
  const hours = Number(b.hours);
  const ends_at = Number.isFinite(hours) && hours > 0 ? new Date(Date.now() + Math.min(hours, 24 * 30) * 3_600_000).toISOString() : null;
  await db.from("announcements").update({ active: false }).eq("active", true);
  const { error } = await db.from("announcements").insert({ text, by_admin: admin, ends_at });
  if (error) return bad("Try again", 503);
  await log(db, admin, "announce", text, { hours: ends_at ? hours : null });
  return ok();
}

export async function unannounce(db: SupabaseClient, admin: string): Promise<Out> {
  await db.from("announcements").update({ active: false }).eq("active", true);
  await log(db, admin, "unannounce", "");
  return ok();
}

/** The announcement players see now, or null. */
export async function currentAnnouncement(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("announcements").select("text, ends_at").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  if (data.ends_at && Date.parse(data.ends_at as string) < Date.now()) return null;
  return data.text as string;
}

export async function adminLog(db: SupabaseClient) {
  const { data, error } = await db.from("admin_log").select("id, admin_id, action, target, detail, at").order("at", { ascending: false }).limit(200);
  if (error) throw error;
  const names = await namesOf(db, (data ?? []).map((r) => r.admin_id as string).filter(Boolean));
  return (data ?? []).map((r) => ({ ...r, admin: names[r.admin_id as string] ?? "Owner" }));
}
