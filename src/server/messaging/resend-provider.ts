import type { MessageProvider, OutboundMessage, SendResult } from "./types";

/**
 * Email through Resend.
 *
 * Uses the REST endpoint rather than the SDK: one fetch, no dependency, and
 * nothing extra in the serverless bundle.
 *
 * Send from a subdomain you have verified (crm.modcon.in), not the domain your
 * staff read mail on — a campaign marked as spam damages the sending domain's
 * reputation, and that should not be able to reach your day-to-day email.
 */
export class ResendProvider implements MessageProvider {
  readonly name = "resend";
  readonly channels = ["EMAIL"] as const;

  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom: string,
  ) {}

  async send(message: OutboundMessage): Promise<SendResult> {
    if (message.channel !== "EMAIL") {
      return { ok: false, error: `Resend cannot deliver ${message.channel} messages.` };
    }

    const from = message.from
      ? message.from.name
        ? `${message.from.name} <${message.from.address}>`
        : message.from.address
      : this.defaultFrom;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject ?? "(no subject)",
          text: message.body,
          // Replies belong to the agent who owns the lead, not to the CRM's
          // sending address, which nobody reads.
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return { ok: false, error: `Resend returned ${response.status}: ${detail.slice(0, 200)}` };
      }

      const body = (await response.json()) as { id?: string };
      return { ok: true, providerMessageId: body.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed to reach Resend" };
    }
  }
}
