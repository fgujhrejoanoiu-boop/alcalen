import process from "node:process";
import { extractBaseEmail } from "./extract-base-email";

export const parseBlacklistedGuestEmails = (value: string | undefined | null): string[] => {
  if (!value) return [];

  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .map((email) => {
      // Booking and guest checks compare addresses after removing any plus tag.
      if (!email.includes("@")) return email;
      return extractBaseEmail(email);
    });
};

export const getBlacklistedGuestEmails = (): string[] =>
  parseBlacklistedGuestEmails(process.env.BLACKLISTED_GUEST_EMAILS);
