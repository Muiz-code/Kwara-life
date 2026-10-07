// Picking the right map for a citizen.
//
// Order: the hand-built Ilorin map for the three Ilorin LGAs, then the map built
// from OpenStreetMap and committed under public/maps, then the generator as the
// fallback for an LGA nobody has fetched yet. Players never call OpenStreetMap.
import { ILORIN_LGAS } from "../data/geography";
import type { State } from "../data/states";
import { generateMap, type CitizenClass } from "./generate";
import { ilorinMap, loadIlorinShapes } from "./ilorin-map";
import { addPlayerPlaces } from "./player-places";
import { normaliseTrips } from "./routing";
import type { WorldMap } from "./types";

export interface MapRequest {
  /** LGA code, e.g. "kwara/ilorin-west". */
  lgaCode: string;
  state: State;
  lgaName: string;
  /** Polling unit index, part of the generator's seed. */
  pu: number;
  cls: CitizenClass;
  job: string;
  home?: string;
  under?: boolean;
  wasUnder?: boolean;
}

export const mapUrl = (lgaCode: string) => `/maps/${lgaCode}.json`;

/** Where the map came from, for the credit line and for telling the player. */
export type MapSource = WorldMap["source"];

export async function loadMap(req: MapRequest, fetcher: typeof fetch = fetch): Promise<WorldMap> {
  if (ILORIN_LGAS.includes(req.lgaCode)) return ilorinMap(await loadIlorinShapes(fetcher));

  const fetched = await fetchMap(req.lgaCode, fetcher);
  if (fetched) {
    return addPlayerPlaces(fetched, {
      seed: `${req.lgaCode}/${req.pu}/${req.cls}`,
      cls: req.cls,
      job: req.job,
      ...(req.home ? { home: req.home } : {}),
      ...(req.under ? { under: true } : {}),
      ...(req.wasUnder ? { wasUnder: true } : {}),
    });
  }

  return normaliseTrips(
    generateMap({
      state: req.state,
      lga: req.lgaName,
      pu: req.pu,
      cls: req.cls,
      job: req.job,
      ...(req.home ? { home: req.home } : {}),
      ...(req.under ? { under: true } : {}),
      ...(req.wasUnder ? { wasUnder: true } : {}),
    }),
  );
}

async function fetchMap(lgaCode: string, fetcher: typeof fetch): Promise<WorldMap | null> {
  try {
    const res = await fetcher(mapUrl(lgaCode));
    if (!res.ok) return null;
    return (await res.json()) as WorldMap;
  } catch {
    // No map fetched for this LGA yet, or the player is offline. The generator covers it.
    return null;
  }
}
