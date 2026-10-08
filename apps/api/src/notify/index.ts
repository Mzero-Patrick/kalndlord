import nodemailer from "nodemailer";
import type { Config } from "../config";

// Every outgoing message (verification codes now, rent reminders and landlord
// notices later) goes through this interface so providers can be swapped.
export interface Notifier {
  sendSms(to: string, text: string): Promise<void>;
  sendEmail(to: string, subject: string, text: string): Promise<void>;
}

export class ConsoleNotifier implements Notifier {
  async sendSms(to: string, text: string) {
    console.log(`[sms -> ${to}] ${text}`);
  }
  async sendEmail(to: string, subject: string, text: string) {
    console.log(`[email -> ${to}] ${subject}: ${text}`);
  }
}

// Africa's Talking covers MTN and Airtel Rwanda.
async function sendAfricasTalkingSms(cfg: Config["sms"], to: string, text: string) {
  if (!cfg.username || !cfg.apiKey) throw new Error("AT_USERNAME and AT_API_KEY are required for SMS");
  const host = cfg.username === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  const body = new URLSearchParams({ username: cfg.username, to, message: text });
  if (cfg.senderId) body.set("from", cfg.senderId);
  const res = await fetch(`https://${host}/version1/messaging`, {
    method: "POST",
    headers: {
      apiKey: cfg.apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`SMS failed with status ${res.status}`);
}

export function createNotifier(config: Config): Notifier {
  const fallback = new ConsoleNotifier();
  const transport =
    config.email.provider === "smtp" && config.email.smtpUrl
      ? nodemailer.createTransport(config.email.smtpUrl)
      : null;

  return {
    sendSms: (to, text) =>
      config.sms.provider === "africastalking"
        ? sendAfricasTalkingSms(config.sms, to, text)
        : fallback.sendSms(to, text),
    sendEmail: async (to, subject, text) => {
      if (!transport) return fallback.sendEmail(to, subject, text);
      await transport.sendMail({ from: config.email.from, to, subject, text });
    },
  };
}
