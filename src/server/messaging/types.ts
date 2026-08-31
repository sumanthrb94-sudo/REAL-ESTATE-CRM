// The contract every messaging provider implements.
//
// Deliberately narrow, and deliberately not shaped like any one vendor's SDK:
// business code should never know whether a message left via Resend, Meta or a
// gateway, in the same way it never knows whether data came from memory or
// Firestore. Swapping vendors then costs one file, not a rewrite.

export type MessageChannel = "EMAIL" | "SMS" | "WHATSAPP";

export interface OutboundMessage {
  channel: MessageChannel;
  /** Email address for EMAIL, E.164 phone number for SMS and WHATSAPP. */
  to: string;
  /** Display name of the recipient, where the channel supports one. */
  toName?: string;
  /** Email only. Ignored by SMS and WhatsApp. */
  subject?: string;
  /** Fully rendered body — no merge tags should survive to this point. */
  body: string;
  /**
   * Who the recipient sees and replies to. The agent who owns the lead, not a
   * shared inbox: a reply to a site-visit invite should reach the person who
   * sent it.
   */
  from?: { name?: string; address: string };
  replyTo?: string;
  /**
   * WhatsApp requires a Meta-approved template name and positional variables
   * for anything outside the 24-hour service window; Indian SMS requires the
   * DLT template id. Providers that do not need these ignore them.
   */
  templateName?: string;
  templateVariables?: string[];
}

export interface SendResult {
  ok: boolean;
  /** The provider's id for the message, needed to match delivery webhooks. */
  providerMessageId?: string;
  error?: string;
}

export interface MessageProvider {
  /** Shown in logs and the boot line, so a misconfigured deploy is obvious. */
  readonly name: string;
  /** Channels this provider can actually deliver. */
  readonly channels: readonly MessageChannel[];
  send(message: OutboundMessage): Promise<SendResult>;
}
