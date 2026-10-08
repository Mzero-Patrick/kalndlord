// Rwandan mobile numbers: 078/079 (MTN), 072/073 (Airtel).
// Accepts 07XXXXXXXX, 2507XXXXXXXX or +2507XXXXXXXX (spaces and dashes ignored)
// and returns the E.164 form +2507XXXXXXXX, or null when invalid.
export function normalizeRwandaPhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "").replace(/^\+/, "");
  let local: string;
  if (/^2507\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^07\d{8}$/.test(digits)) local = digits.slice(1);
  else return null;
  if (!/^7[2389]/.test(local)) return null;
  return `+250${local}`;
}

export type MobileNetwork = "MTN" | "AIRTEL";

export function mobileNetworkOf(e164: string): MobileNetwork | null {
  const prefix = e164.slice(4, 6);
  if (prefix === "78" || prefix === "79") return "MTN";
  if (prefix === "72" || prefix === "73") return "AIRTEL";
  return null;
}
