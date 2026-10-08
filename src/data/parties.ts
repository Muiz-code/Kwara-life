// Generated from reference/naija-votes-2027.html by scripts/gen-naija-data.mjs. Edit the data here from now on.
// INEC-registered parties (21 after DLA and NDC joined on 5 Feb 2026). Re-check INEC's list before launch.
// Rules: the ballot lists them alphabetically by code, every box the same size, no logos. Colours are only for
// result charts. Never hard-code a party anywhere in the UI; always read this list.
import { lookup } from "./lookup";

export interface Party {
  code: string;
  name: string;
  colour: string;
}

export const PARTIES: Party[] = [
  { code: "A", name: "Accord", colour: "#2E6F95" },
  { code: "AA", name: "Action Alliance", colour: "#B5532E" },
  { code: "AAC", name: "African Action Congress", colour: "#3F7D4E" },
  { code: "ADC", name: "African Democratic Congress", colour: "#8C2F5A" },
  { code: "ADP", name: "Action Democratic Party", colour: "#C08A1E" },
  { code: "APC", name: "All Progressives Congress", colour: "#4B4E9C" },
  { code: "APGA", name: "All Progressives Grand Alliance", colour: "#2F8C8C" },
  { code: "APM", name: "Allied Peoples Movement", colour: "#9C4A2F" },
  { code: "APP", name: "Action Peoples Party", colour: "#6B7A2F" },
  { code: "BP", name: "Boot Party", colour: "#7A3E8C" },
  { code: "DLA", name: "Democratic Leadership Alliance", colour: "#2F5D8C" },
  { code: "LP", name: "Labour Party", colour: "#A0523E" },
  { code: "NDC", name: "Nigeria Democratic Congress", colour: "#3E8C6B" },
  { code: "NNPP", name: "New Nigeria Peoples Party", colour: "#8C6B2F" },
  { code: "NRM", name: "National Rescue Movement", colour: "#5E3E8C" },
  { code: "PDP", name: "Peoples Democratic Party", colour: "#2F7A5E" },
  { code: "PRP", name: "Peoples Redemption Party", colour: "#8C3E52" },
  { code: "SDP", name: "Social Democratic Party", colour: "#4E6F2F" },
  { code: "YP", name: "Youth Party", colour: "#2F4E8C" },
  { code: "YPP", name: "Young Progressives Party", colour: "#8C5A2F" },
  { code: "ZLP", name: "Zenith Labour Party", colour: "#5A8C2F" },
];

export const PARTY = lookup(PARTIES, (p) => p.code);
