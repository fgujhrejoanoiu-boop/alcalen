import { describe, expect, it } from "vitest";
import { IntlSupportedTimeZones } from "./timeZones";

const hourAt = (timeZone: string, instant: Date): string =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(instant);

describe("IntlSupportedTimeZones", () => {
  it("offers only time zones accepted by Intl", () => {
    for (const timeZone of IntlSupportedTimeZones) {
      expect(() => new Intl.DateTimeFormat("en-GB", { timeZone })).not.toThrow();
    }
  });

  it("lists Aysén separately from Santiago during southern winter", () => {
    const southernWinter = new Date("2026-07-15T12:00:00Z");

    expect(IntlSupportedTimeZones).toContain("America/Coyhaique");
    expect(hourAt("America/Coyhaique", southernWinter)).toBe("09");
    expect(hourAt("America/Santiago", southernWinter)).toBe("08");
  });
});
