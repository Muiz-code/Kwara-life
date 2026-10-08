import type { Look } from "./character";

export type FriendId = "aisha" | "tunde" | "basira" | "kayode";

export interface Friend {
  name: string;
  role: string;
  lines: string[];
  /** Extra line shown when friendship reaches 3 hearts. */
  unlock?: string;
  look: Look;
}

export const MAX_HEARTS = 5;

export const FRIENDS: Record<FriendId, Friend> = {
  aisha: {
    name: "Oyin",
    role: "Coursemate at Unilorin",
    lines: ["Oyin shared her lecture notes with you.", "Oyin gisted you about the new HOD.", "Oyin says you should form a study group."],
    look: { g: "f", skin: "#6B3E26", cloth: "#8C2F5A" },
  },
  tunde: {
    name: "Tunde",
    role: "Plays ball at Kwara Stadium",
    lines: ["Tunde says you play like Kanu.", "Tunde told you about a party next week.", "Tunde laughed at your first touch, but in a friendly way."],
    look: { g: "m", skin: "#4A2A18", cloth: "#C0392B" },
  },
  basira: {
    name: "Mama Basira",
    role: "Serves at Amala Place",
    lines: ["Mama Basira added extra ponmo for you.", "Mama Basira asked about your family.", "Mama Basira says you are too thin."],
    unlock: "From now on, Mama Basira gives you amala for ₦1,800.",
    look: { g: "f", skin: "#8D5524", cloth: "#B5532E" },
  },
  kayode: {
    name: "Kayode",
    role: "Founder at the Innovation Hub",
    lines: ["Kayode showed you the app he is building.", "Kayode reviewed your code and was impressed.", "Kayode says Ilorin is the next tech city."],
    look: { g: "m", skin: "#A86B3C", cloth: "#26355E" },
  },
};

export const FRIEND_IDS = Object.keys(FRIENDS) as FriendId[];
