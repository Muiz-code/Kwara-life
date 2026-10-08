// Picking the right map for a citizen.
//
// Every LGA is a grid town built from a seed made from its LGA code, so it is the
// same for everyone there and different from every other LGA. The three Ilorin
// LGAs share Ilorin, laid out from its real places.
import { ILORIN_LGAS } from "../data/geography";
import type { CareerId } from "../data/careers";
import type { ClassId } from "../data/jobs";
import type { State } from "../data/states";
import { ilorinTown } from "./ilorin-town";
import { buildTown } from "./town";
import { townSpecFor } from "./town-spec";
import type { WorldMap } from "./types";

export interface MapRequest {
  /** LGA code, e.g. "kano/fagge". */
  lgaCode: string;
  state: State;
  lgaName: string;
  cls: ClassId;
  job: string;
  home?: string;
  under?: boolean;
  wasUnder?: boolean;
  /** In this LGA as a visitor: no home, work or shelter of theirs here. */
  visiting?: boolean;
  career?: CareerId;
  /** Anything stable and unique to the citizen, so their own home is always on the same street. */
  citizenSeed?: string;
  /** The citizen's polling unit index. Used for the home's seed when there is no citizenSeed. */
  pu?: number;
}

/** Built maps are kept, since a town is the same every time it is built. */
const cache = new Map<string, WorldMap>();

/** The town for a citizen. Async so a caller need not change if towns are ever fetched. */
export async function loadMap(req: MapRequest): Promise<WorldMap> {
  return townFor(req);
}

/** The town for a citizen, built (or taken from the cache) right away. */
export function townFor(req: MapRequest): WorldMap {
  if (ILORIN_LGAS.includes(req.lgaCode)) {
    const hit = cache.get("ilorin");
    if (hit) return hit;
    const map = ilorinTown();
    cache.set("ilorin", map);
    return map;
  }
  const key = JSON.stringify([req.lgaCode, req.cls, req.job, req.home, req.under, req.wasUnder, req.visiting, req.career, req.citizenSeed, req.pu]);
  const hit = cache.get(key);
  if (hit) return hit;
  const { map } = buildTown(
    townSpecFor({
      lgaCode: req.lgaCode,
      state: req.state,
      lgaName: req.lgaName,
      ctx: {
        cls: req.cls,
        job: req.job,
        home: req.home ?? "",
        underFlyover: !!req.under,
        ...(req.wasUnder ? { wasUnder: true } : {}),
        ...(req.visiting ? { visiting: true } : {}),
        ...(req.career ? { career: req.career } : {}),
      },
      citizenSeed: req.citizenSeed ?? `pu${req.pu ?? 0}/${req.cls}/${req.home ?? ""}`,
    }),
  );
  cache.set(key, map);
  return map;
}
