import { afterEach, describe, expect, it, vi } from "vitest";
import { getBlacklistedGuestEmails, parseBlacklistedGuestEmails } from "./getBlacklistedGuestEmails";

describe("parseBlacklistedGuestEmails", () => {
  it.each([undefined, null, ""])("returns an empty list for %s", (value) => {
    expect(parseBlacklistedGuestEmails(value)).toEqual([]);
  });

  it("trims and lowercases entries, removes plus tags, and drops empty entries", () => {
    expect(parseBlacklistedGuestEmails(" First@Example.com,\n ,Second+tag@Example.COM ,")).toEqual([
      "first@example.com",
      "second@example.com",
    ]);
  });

  it("keeps entries without an at sign", () => {
    expect(parseBlacklistedGuestEmails("not-an-email, a@example.com")).toEqual([
      "not-an-email",
      "a@example.com",
    ]);
  });
});

describe("getBlacklistedGuestEmails", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the current environment setting", () => {
    vi.stubEnv("BLACKLISTED_GUEST_EMAILS", "A@example.com, b@example.com");
    expect(getBlacklistedGuestEmails()).toEqual(["a@example.com", "b@example.com"]);

    vi.stubEnv("BLACKLISTED_GUEST_EMAILS", undefined);
    expect(getBlacklistedGuestEmails()).toEqual([]);
  });
});
