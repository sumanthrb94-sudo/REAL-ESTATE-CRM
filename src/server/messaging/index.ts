// Provider selection, mirroring how src/server/db picks its data driver.
//
// MESSAGING_DRIVER defaults to `log`, so nothing can silently start emailing
// real buyers because a key happened to be present in the environment.
import { LogProvider } from "./log-provider";
import { ResendProvider } from "./resend-provider";
import type { MessageProvider, OutboundMessage, SendResult } from "./types";

export type { MessageChannel, MessageProvider, OutboundMessage, SendResult } from "./types";
export { renderStrict, renderTemplate, templateVariables } from "./render";

const globalForMessaging = globalThis as unknown as { __estateMessaging?: MessageProvider };

function init(): MessageProvider {
  const driver = process.env.MESSAGING_DRIVER ?? "log";

  switch (driver) {
    case "resend": {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!apiKey || !from) {
        // Refuse rather than fall back to `log`: a deployment that believes it
        // is emailing customers and is not would be discovered by a customer.
        throw new Error(
          "[messaging] MESSAGING_DRIVER=resend requires RESEND_API_KEY and EMAIL_FROM.",
        );
      }
      console.log(`[messaging] driver=resend from=${from}`);
      return new ResendProvider(apiKey, from);
    }
    case "log":
      console.log("[messaging] driver=log (nothing is delivered; messages are recorded only)");
      return new LogProvider();
    default:
      throw new Error(
        `[messaging] Unknown MESSAGING_DRIVER "${driver}". Use "log" or "resend".`,
      );
  }
}

// Cached on globalThis for the same reason the data store is: Next bundles
// server code per route, so this module is evaluated more than once per process.
export const messaging: MessageProvider = globalForMessaging.__estateMessaging ?? init();
globalForMessaging.__estateMessaging = messaging;

/** True when messages are only being recorded, so the UI can say so honestly. */
export function isDeliveryEnabled(): boolean {
  return messaging.name !== "log";
}

export async function sendMessage(message: OutboundMessage): Promise<SendResult> {
  if (!messaging.channels.includes(message.channel)) {
    return {
      ok: false,
      error: `${message.channel} is not configured yet. The ${messaging.name} provider delivers ${messaging.channels.join(", ")}.`,
    };
  }
  return messaging.send(message);
}
