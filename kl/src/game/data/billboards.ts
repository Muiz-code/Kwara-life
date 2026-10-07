// Paid ad billboards on the map. Slots are placed beside real roads, next to the
// place they belong to. Advertisers upload and pay for ads later (Supabase phase);
// until an ad is booked, a slot shows a "Your ad here" board.

export interface AdSlot {
  id: string;
  /** Place the board stands beside. */
  near: string;
  /** Offset from the place in world pixels. */
  dx: number;
  dy: number;
}

export interface Ad {
  slotId: string;
  advertiser: string;
  image: string;
  link?: string;
  /** ISO dates the ad runs between. */
  starts: string;
  ends: string;
}

export const AD_SLOTS: AdSlot[] = [
  { id: "po-bridge", near: "po", dx: -150, dy: -40 },
  { id: "taiwo-road", near: "taiwo", dx: 140, dy: -30 },
  { id: "ahmadu-bello", near: "hotel", dx: 0, dy: 120 },
  { id: "fate-road", near: "mall", dx: -130, dy: 90 },
  { id: "tanke-road", near: "home", dx: -140, dy: -50 },
  { id: "unilorin-road", near: "okeodo", dx: 0, dy: 130 },
];
