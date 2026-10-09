import { describe, expect, it } from "vitest";
import { PRESIDENTIAL_2027 as CAL } from "../data/calendar";
import { PVC_GRACE_MS, reachPvc } from "./civic";

const at = (iso: string) => Date.parse(iso);
const made = at("2026-10-14T09:00:00+01:00");

describe("PVC steps the server accepts", () => {
  it("registers only while registration is open, with a little grace for the upload", () => {
    expect(reachPvc("none", "registered", made, at("2026-10-20T10:00:00+01:00"))).toBe("registered");
    expect(reachPvc("none", "registered", made, Date.parse(CAL.registrationClose) + PVC_GRACE_MS - 1000)).toBe("registered");
    expect(reachPvc("none", "registered", made, at("2026-10-31T09:00:00+01:00"))).toBe("none");
  });

  it("collects only while collection is open, and only after registering", () => {
    expect(reachPvc("registered", "have", made, at("2026-10-25T10:00:00+01:00"))).toBe("registered");
    expect(reachPvc("registered", "have", made, at("2026-11-05T10:00:00+01:00"))).toBe("have");
    expect(reachPvc("none", "have", made, at("2026-11-05T10:00:00+01:00"))).toBe("none");
  });

  it("never goes backwards, and a seizure sticks", () => {
    expect(reachPvc("have", "none", made, at("2026-11-05T10:00:00+01:00"))).toBe("have");
    expect(reachPvc("have", "seized", made, at("2026-11-05T10:00:00+01:00"))).toBe("seized");
    expect(reachPvc("seized", "have", made, at("2026-11-05T10:00:00+01:00"))).toBe("seized");
  });
});
