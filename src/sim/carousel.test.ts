import { describe, expect, it } from "vitest";
import { bookingEnds, faceHasRoom, liveQueue, showing } from "./carousel";

const ad = (name: string, paidAt: number, until = Infinity) => ({ name, paidAt, until });

describe("billboard carousel", () => {
  const queue = [ad("Mama Put", 2000), ad("Klario", 1000), ad("Raavon", 3000)];

  it("takes turns in the order ads were booked, a slot each", () => {
    const at = (slot: number) => showing(queue, slot * 8000 + 5000, 8000).ad?.name;
    expect([at(3), at(4), at(5), at(6)]).toEqual(["Klario", "Mama Put", "Raavon", "Klario"]);
    expect(showing(queue, 3 * 8000 + 5000, 8000)).toMatchObject({ count: 3, changesAt: 4 * 8000 });
  });

  it("shows everyone the same ad at the same moment", () => {
    const now = 1_791_400_123_456;
    expect(showing(queue, now, 8000).ad).toBe(showing([...queue].reverse(), now, 8000).ad);
  });

  it("drops ads whose showings are used up, and waits for ads booked later", () => {
    const q = [ad("Old", 0, 50_000), ad("New", 100_000)];
    expect(liveQueue(q, 60_000)).toEqual([]);
    expect(showing(q, 60_000, 8000).ad).toBeNull();
    expect(liveQueue(q, 120_000).map((a) => a.name)).toEqual(["New"]);
  });

  it("guarantees the showings bought even on a full face", () => {
    // 100 showings of 8 s on a face shared by 6: up to 100 turns of 6 slots.
    expect(bookingEnds(0, 100, 8000, 6)).toBe(100 * 8000 * 6);
  });

  it("caps how many ads share a face", () => {
    expect(faceHasRoom(queue, 10_000, 3)).toBe(false);
    expect(faceHasRoom(queue, 10_000, 4)).toBe(true);
  });
});
