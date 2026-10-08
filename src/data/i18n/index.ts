// Generated from reference/naija-votes-2027.html by scripts/gen-naija-data.mjs. Edit the data here from now on.
import en from "./en";
import pcm from "./pcm";
import yo from "./yo";
import ha from "./ha";
import ig from "./ig";

export type Lang = "en" | "pcm" | "yo" | "ha" | "ig";
export type Strings = Record<keyof typeof en, string>;

export const LANGS: { code: Lang; name: string }[] = [{"code":"en","name":"English"},{"code":"pcm","name":"Pidgin"},{"code":"yo","name":"Yorùbá"},{"code":"ha","name":"Hausa"},{"code":"ig","name":"Igbo"}];

const ALL: Record<Lang, Strings> = { en, pcm, yo, ha, ig };

/** Look up a UI string, falling back to English. */
export function t(lang: Lang, key: keyof Strings): string {
  return ALL[lang]?.[key] || en[key];
}
