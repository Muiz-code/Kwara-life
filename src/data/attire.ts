// What a citizen wears, by where they are from. The player picks man, woman, or woman in hijab, a skin
// tone and a colour; their state picks the cut and the fabric. Native-speaker and cultural review is
// still needed before release (see docs/HANDOVER.md).
import type { Gender } from "./character";
import { STATE } from "./states";

/** The main garment. */
export type Body =
  | "agbada" // Yoruba: buba and sokoto under a wide flowing agbada
  | "babbanriga" // Hausa and Fulani: a very wide embroidered gown to the ankle
  | "isiagu" // Igbo: the lion-head print top
  | "etibo" // Niger Delta: a long collarless shirt over a wrapper
  | "kaftan" // a knee-length kaftan and trousers
  | "iro" // Yoruba: iro wrapper, buba blouse, ipele over the shoulder
  | "wrapper" // a blouse with a double wrapper
  | "abaya"; // a long gown

/** What is on the head. */
export type Head = "fila" | "hula" | "okpu" | "bowler" | "gele" | "ichafu" | "mayafi" | "hijab";

/** How the cloth is woven or printed. */
export type Pattern = "plain" | "asooke" | "embroidery" | "lion" | "anger" | "george" | "atamfa";

export interface Attire {
  /** What the look button says. */
  label: string;
  body: Body;
  head: Head;
  pattern: Pattern;
  /** Coral beads round the neck (Edo and Delta). */
  beads?: boolean;
}

type Culture = "yoruba" | "north" | "igbo" | "delta" | "edo" | "tiv" | "middle";

/** States whose everyday dress differs from the rest of their zone. */
const STATE_CULTURE: Record<string, Culture> = {
  kwara: "yoruba", kogi: "middle", benue: "tiv", plateau: "middle", nasarawa: "middle", fct: "middle", niger: "north",
  edo: "edo", delta: "delta",
};
const ZONE_CULTURE: Record<string, Culture> = { SW: "yoruba", NW: "north", NE: "north", SE: "igbo", SS: "delta", NC: "middle" };

const DRESS: Record<Culture, Record<Gender, Attire>> = {
  yoruba: {
    m: { label: "Agbada and fila", body: "agbada", head: "fila", pattern: "asooke" },
    f: { label: "Iro, buba and gele", body: "iro", head: "gele", pattern: "asooke" },
    h: { label: "Buba and hijab", body: "abaya", head: "hijab", pattern: "plain" },
  },
  north: {
    m: { label: "Babban riga and hula", body: "babbanriga", head: "hula", pattern: "embroidery" },
    f: { label: "Atamfa and mayafi", body: "wrapper", head: "mayafi", pattern: "atamfa" },
    h: { label: "Abaya and hijab", body: "abaya", head: "hijab", pattern: "plain" },
  },
  igbo: {
    m: { label: "Isiagu and red cap", body: "isiagu", head: "okpu", pattern: "lion" },
    f: { label: "Wrapper and ichafu", body: "wrapper", head: "ichafu", pattern: "george" },
    h: { label: "Gown and hijab", body: "abaya", head: "hijab", pattern: "plain" },
  },
  delta: {
    m: { label: "Etibo, wrapper and hat", body: "etibo", head: "bowler", pattern: "george", beads: true },
    f: { label: "George wrapper and head tie", body: "wrapper", head: "ichafu", pattern: "george", beads: true },
    h: { label: "Gown and hijab", body: "abaya", head: "hijab", pattern: "plain" },
  },
  edo: {
    m: { label: "Wrapper, shirt and coral beads", body: "etibo", head: "fila", pattern: "plain", beads: true },
    f: { label: "Wrapper, coral beads and head tie", body: "wrapper", head: "ichafu", pattern: "george", beads: true },
    h: { label: "Gown and hijab", body: "abaya", head: "hijab", pattern: "plain" },
  },
  tiv: {
    m: { label: "A'nger robe and cap", body: "kaftan", head: "hula", pattern: "anger" },
    f: { label: "A'nger wrapper and head tie", body: "wrapper", head: "ichafu", pattern: "anger" },
    h: { label: "Gown and hijab", body: "abaya", head: "hijab", pattern: "plain" },
  },
  middle: {
    m: { label: "Kaftan and cap", body: "kaftan", head: "hula", pattern: "embroidery" },
    f: { label: "Ankara wrapper and head tie", body: "wrapper", head: "ichafu", pattern: "atamfa" },
    h: { label: "Gown and hijab", body: "abaya", head: "hijab", pattern: "plain" },
  },
};

/** The everyday dress of a state, for a man, a woman, or a woman in hijab. */
export function attireFor(stateCode: string, g: Gender): Attire {
  const st = STATE[stateCode];
  const culture = STATE_CULTURE[stateCode] ?? (st ? ZONE_CULTURE[st.zone] : undefined) ?? "middle";
  return DRESS[culture][g];
}
