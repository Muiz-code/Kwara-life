// Usage: node scripts/extract-naija.mjs reference/naija-votes-2027.html <out.json>
import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync(process.argv[2], "utf8");
const start = html.indexOf("const PARTIES=");
const end = html.indexOf("(function(){", start);
const top = html.slice(start, end);
const iife = html.slice(end);
const grab = (from, to) => { const a = iife.indexOf(from), b = iife.indexOf(to, a); return iife.slice(a, b); };
const region = grab("const BIOME=", "/* ---------- world");
const foodmap = grab("const FOODMAP=", "const HOME_ACTS=");
const news = grab("const NEWS=", "const curNews=");
const misc = "const ELECTION_DAY=10, REG_CLOSE=7, PVC_CLOSE=9;" + grab("const PAYD=", "const ACT=") + grab("const MSPEC=", "const modeList=") + grab("const SIMNAMES=", "const spentToday=");
const D = new Function(`${top}${region}${foodmap}${news}${misc}
  const MKTS={};for(const z in MKT)MKTS[z]=MKT[z]("X");
  return {PARTIES,PCOL,STATES,ZONES,JOBS,PAY,START,HOMES,LANGS,T,ISSUES,MODES,MODE_LINES,WORK_STEPS,PROMO,DAILY_CAP,BAD_WORDS,BIOME,BIO,LMK,FOOD,MKTS,ROADS,FOODMAP,NEWS,ADS,RADIOS,PAYD,MSPEC_KEYS:Object.keys(MSPEC),SIMNAMES}`)();
writeFileSync(process.argv[3], JSON.stringify(D, null, 1));
console.log(Object.keys(D).map(k => k + ":" + (Array.isArray(D[k]) ? D[k].length : typeof D[k])).join(" "));
