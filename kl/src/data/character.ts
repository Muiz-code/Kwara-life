/** m: kaftan and fila, f: aso-oke and gele, h: gown and hijab */
export type Gender = "m" | "f" | "h";

export interface Look {
  g: Gender;
  skin: string;
  cloth: string;
}

export interface Character extends Look {
  name: string;
}

export const SKINS = ["#8D5524", "#6B3E26", "#4A2A18", "#A86B3C"];
export const CLOTHS = ["#F4F1EA", "#2F7D7A", "#8C2F5A", "#26355E", "#B5532E", "#3F6B3A"];

export const LOOK_LABELS: Record<Gender, string> = {
  m: "Kaftan and fila",
  f: "Aso-oke and gele",
  h: "Gown and hijab",
};

/** Higgsfield avatar art for each look. */
export const AVATAR_ART: Record<Gender, string> = {
  m: "/assets/avatar-man-kaftan.webp",
  f: "/assets/avatar-woman-gele.webp",
  h: "/assets/avatar-woman-hijab.webp",
};

export const defaultName = (g: Gender) => (g === "m" ? "Tunji" : "Aduke");
