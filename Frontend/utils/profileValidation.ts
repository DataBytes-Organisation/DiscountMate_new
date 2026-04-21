import { UserProfile } from "../types/UserProfile";

export const PASSWORD_SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9\s]/;
const AU_POSTCODE_REGEX = /^\d{4}$/;
const AU_NATIONAL_NUMBER_REGEX = /^(4\d{8}|[2378]\d{8})$/;

export type ProfileFieldErrorMap = Partial<
   Record<"firstName" | "lastName" | "phoneNumber" | "address" | "postcode", string>
>;

function digitsOnly(value: string): string {
   return String(value || "").replace(/\D/g, "");
}

export function validatePasswordStrength(password: string): string | null {
   if (String(password || "").length < 8) {
      return "Password must be at least 8 characters long.";
   }

   if (!PASSWORD_SPECIAL_CHARACTER_REGEX.test(password)) {
      return "Password must include at least one special character.";
   }

   return null;
}

export function normalizeAustralianPhoneNumber(value?: string | null): string | null {
   const raw = String(value || "").trim();
   if (!raw) {
      return "";
   }

   const digits = digitsOnly(raw);
   let nationalNumber = "";

   if (digits.startsWith("61") && digits.length === 11) {
      nationalNumber = digits.slice(2);
   } else if (digits.startsWith("0") && digits.length === 10) {
      nationalNumber = digits.slice(1);
   } else {
      return null;
   }

   if (!AU_NATIONAL_NUMBER_REGEX.test(nationalNumber)) {
      return null;
   }

   if (nationalNumber.startsWith("4")) {
      return `+61 ${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
   }

   return `+61 ${nationalNumber.slice(0, 1)} ${nationalNumber.slice(1, 5)} ${nationalNumber.slice(5)}`;
}

export function validateProfileForm(
   profile: Pick<UserProfile, "firstName" | "lastName" | "phoneNumber" | "address" | "postcode">
): ProfileFieldErrorMap {
   const errors: ProfileFieldErrorMap = {};
   const firstName = String(profile.firstName || "").trim();
   const lastName = String(profile.lastName || "").trim();
   const phoneNumber = String(profile.phoneNumber || "").trim();
   const address = String(profile.address || "").trim();
   const postcode = String(profile.postcode || "").trim();

   if (firstName && firstName.length < 2) {
      errors.firstName = "First name should be at least 2 characters.";
   }

   if (lastName && lastName.length < 2) {
      errors.lastName = "Last name should be at least 2 characters.";
   }

   if (phoneNumber && !normalizeAustralianPhoneNumber(phoneNumber)) {
      errors.phoneNumber =
         "Enter a valid Australian phone number, for example 0412 345 678 or +61 412 345 678.";
   }

   if (address && address.length < 5) {
      errors.address = "Address should be at least 5 characters.";
   }

   if (postcode && !AU_POSTCODE_REGEX.test(postcode)) {
      errors.postcode = "Postcode must be a 4-digit Australian postcode.";
   }

   return errors;
}
