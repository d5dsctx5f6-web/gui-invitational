import { describe, expect, it } from "vitest";
import { groupTeeTimeIso } from "./teeTimes";
import { arizonaLocalToUtcIso, formatArizonaTime } from "../../lib/timezone";

// Montana (MDT) and Arizona (MST, no DST) are both UTC-7 in late March, so a timezone bug is
// invisible from Bozeman. These tests assert the stored UTC instant and render under other zones.

describe("tee-time storage and rendering", () => {
  it("11:00 AM Saturday Phoenix is stored as 2027-03-27T18:00:00Z", () => {
    expect(arizonaLocalToUtcIso("2027-03-27T11:00")).toBe("2027-03-27T18:00:00.000Z");
  });

  it("11:40 AM Sunday Phoenix is stored as 2027-03-28T18:40:00Z", () => {
    expect(arizonaLocalToUtcIso("2027-03-28T11:40")).toBe("2027-03-28T18:40:00.000Z");
  });

  it("derives group times as first tee + (slot - 1) x interval", () => {
    const first = "2027-03-27T18:00:00.000Z";
    expect([1, 2, 3, 4].map((k) => groupTeeTimeIso(first, 10, k))).toEqual([
      "2027-03-27T18:00:00.000Z",
      "2027-03-27T18:10:00.000Z",
      "2027-03-27T18:20:00.000Z",
      "2027-03-27T18:30:00.000Z",
    ]);
    expect(groupTeeTimeIso(first, 8, 4)).toBe("2027-03-27T18:24:00.000Z");
  });

  it("rejects an invalid slot or timestamp", () => {
    expect(() => groupTeeTimeIso("2027-03-27T18:00:00Z", 10, 0)).toThrow();
    expect(() => groupTeeTimeIso("nope", 10, 1)).toThrow();
  });

  it("renders Phoenix wall-clock time regardless of the process timezone", () => {
    const iso = "2027-03-27T18:00:00.000Z";
    const original = process.env.TZ;
    try {
      for (const tz of ["America/New_York", "America/Denver", "Asia/Tokyo", "UTC"]) {
        process.env.TZ = tz;
        expect(formatArizonaTime(iso)).toBe("11:00 AM");
        expect(arizonaLocalToUtcIso("2027-03-27T11:00")).toBe(iso);
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("the New York wall clock for the same instant is 2:00 PM, i.e. the zones really differ", () => {
    const nyc = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date("2027-03-27T18:00:00.000Z"));
    expect(nyc).toBe("2:00 PM");
  });
});
