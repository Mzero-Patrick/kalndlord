import type { User } from "@prisma/client";
import type { Notifier } from "../notify";

// Sends a message to whichever contact the user registered (SMS first, then
// email). A failed message is logged and never fails the request that caused it.
export async function notifyUser(notifier: Notifier, user: Pick<User, "phone" | "email">, subject: string, text: string) {
  try {
    if (user.phone) await notifier.sendSms(user.phone, `Kalndlord: ${text}`);
    else if (user.email) await notifier.sendEmail(user.email, subject, text);
  } catch (err) {
    console.error("Notification failed", err);
  }
}
