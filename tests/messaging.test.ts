import { afterEach, describe, expect, it, vi } from "vitest";
import { renderStrict, renderTemplate, templateVariables } from "@/server/messaging/render";
import { LogProvider } from "@/server/messaging/log-provider";
import { ResendProvider } from "@/server/messaging/resend-provider";

describe("template rendering", () => {
  const lead = { name: "Sanjay Kulkarni", project: "Agartha", agent: "Rohan Kapoor" };

  it("substitutes merge tags", () => {
    expect(
      renderStrict("Hi {{name}}, thanks for your interest in {{project}}.", lead),
    ).toBe("Hi Sanjay Kulkarni, thanks for your interest in Agartha.");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderStrict("Hi {{ name }}!", lead)).toBe("Hi Sanjay Kulkarni!");
  });

  it("reports which tags had no value", () => {
    const { missing } = renderTemplate("Hi {{name}}, about {{unit}} at {{project}}", lead);
    expect(missing).toEqual(["unit"]);
  });

  it("refuses to send a half-filled message", () => {
    // "Hi Sanjay, your unit  at Agartha" reaching a buyer is worse than an error.
    expect(() => renderStrict("Hi {{name}}, your unit {{unit}}", lead)).toThrow(/\{\{unit\}\}/);
  });

  it("treats an empty string as missing, not as a value", () => {
    expect(() => renderStrict("Hi {{name}}", { name: "" })).toThrow();
  });

  it("lists the variables a template expects", () => {
    expect(templateVariables("{{name}} — {{project}} — {{name}}")).toEqual(["name", "project"]);
  });

  it("leaves text without tags untouched", () => {
    expect(renderStrict("No tags here.", {})).toBe("No tags here.");
  });
});

describe("log provider", () => {
  it("reports success without delivering anything", async () => {
    const provider = new LogProvider();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await provider.send({
      channel: "EMAIL",
      to: "sanjay.k@example.com",
      subject: "Visit Agartha",
      body: "Hi Sanjay",
    });
    expect(result.ok).toBe(true);
    expect(spy.mock.calls[0]?.[0]).toContain("would send EMAIL");
    spy.mockRestore();
  });
});

describe("resend provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  const captureRequest = (response: Response) => {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("posts the message and returns the provider id", async () => {
    const fetchMock = captureRequest(
      new Response(JSON.stringify({ id: "re_123" }), { status: 200 }),
    );
    const provider = new ResendProvider("re_test_key", "EstateCRM <noreply@crm.modcon.in>");

    const result = await provider.send({
      channel: "EMAIL",
      to: "sanjay.k@example.com",
      subject: "Visit Agartha this weekend",
      body: "Hi Sanjay",
      from: { name: "Rohan Kapoor", address: "rohan@crm.modcon.in" },
      replyTo: "rohan@modcon.in",
    });

    expect(result).toEqual({ ok: true, providerMessageId: "re_123" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");

    const sent = JSON.parse(init.body as string);
    // The agent is the sender and the reply target, so a buyer's reply reaches
    // a person rather than an unread CRM mailbox.
    expect(sent.from).toBe("Rohan Kapoor <rohan@crm.modcon.in>");
    expect(sent.reply_to).toBe("rohan@modcon.in");
    expect(sent.to).toEqual(["sanjay.k@example.com"]);
  });

  it("falls back to the configured sender when the caller gives none", async () => {
    const fetchMock = captureRequest(new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    const provider = new ResendProvider("k", "EstateCRM <noreply@crm.modcon.in>");
    await provider.send({ channel: "EMAIL", to: "a@b.com", subject: "s", body: "b" });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).from).toBe(
      "EstateCRM <noreply@crm.modcon.in>",
    );
  });

  it("surfaces a provider rejection instead of claiming success", async () => {
    captureRequest(new Response("domain is not verified", { status: 403 }));
    const provider = new ResendProvider("k", "noreply@crm.modcon.in");
    const result = await provider.send({ channel: "EMAIL", to: "a@b.com", subject: "s", body: "b" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("403");
    expect(result.error).toContain("domain is not verified");
  });

  it("survives the network being down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const provider = new ResendProvider("k", "noreply@crm.modcon.in");
    const result = await provider.send({ channel: "EMAIL", to: "a@b.com", subject: "s", body: "b" });
    expect(result).toEqual({ ok: false, error: "ECONNREFUSED" });
  });

  it("refuses a channel it cannot deliver", async () => {
    const provider = new ResendProvider("k", "noreply@crm.modcon.in");
    const result = await provider.send({ channel: "WHATSAPP", to: "+919848012121", body: "hi" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("WHATSAPP");
  });
});
