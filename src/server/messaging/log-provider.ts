import type { MessageProvider, OutboundMessage, SendResult } from "./types";

/**
 * The default provider: records what would have been sent, and sends nothing.
 *
 * This is what makes the rest of the messaging layer buildable and testable
 * before any account exists. It is also the honest default — the previous
 * behaviour was to write "Email sent to <name>" into the timeline while no
 * provider existed at all, which is the failure mode this replaces.
 */
export class LogProvider implements MessageProvider {
  readonly name = "log";
  readonly channels = ["EMAIL", "SMS", "WHATSAPP"] as const;

  async send(message: OutboundMessage): Promise<SendResult> {
    console.log(
      `[messaging] would send ${message.channel} to ${message.to}` +
        (message.subject ? ` subject="${message.subject}"` : "") +
        ` body="${message.body.slice(0, 80)}${message.body.length > 80 ? "…" : ""}"`,
    );
    return { ok: true, providerMessageId: `log_${Date.now().toString(36)}` };
  }
}
