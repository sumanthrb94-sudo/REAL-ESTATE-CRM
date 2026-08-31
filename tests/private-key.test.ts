import { describe, expect, it } from "vitest";
import { createPrivateKey } from "node:crypto";
import { generateKeyPairSync } from "node:crypto";
import { normalisePrivateKey, describePrivateKey } from "@/server/db/private-key";

// A real PKCS#8 key, generated here so no secret lives in the repo.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const PEM = privateKey as unknown as string;

/** The check that matters: OpenSSL must accept the result. */
const parses = (key: string): boolean => {
  try {
    createPrivateKey(key);
    return true;
  } catch {
    return false;
  }
};

describe("normalisePrivateKey", () => {
  it("leaves a well-formed PEM usable", () => {
    expect(parses(normalisePrivateKey(PEM))).toBe(true);
  });

  it("repairs the manglings a dashboard paste introduces", () => {
    const escaped = PEM.replace(/\n/g, "\\n");
    const cases: Record<string, string> = {
      "escaped newlines": escaped,
      "double-escaped newlines": PEM.replace(/\n/g, "\\\\n"),
      "wrapped in double quotes": `"${escaped}"`,
      "wrapped in single quotes": `'${escaped}'`,
      "surrounding whitespace": `\n  ${escaped}  \n`,
      "newlines stripped entirely": PEM.replace(/\n/g, ""),
      "newlines replaced by spaces": PEM.replace(/\n/g, " "),
      "windows line endings": PEM.replace(/\n/g, "\r\n"),
      "quoted and double-escaped": `"${PEM.replace(/\n/g, "\\\\n")}"`,
    };
    for (const [name, mangled] of Object.entries(cases)) {
      expect(parses(normalisePrivateKey(mangled)), `${name} should still parse`).toBe(true);
    }
  });

  it("rebuilds a marker lost to a truncated paste", () => {
    const escaped = PEM.replace(/\n/g, "\\n");
    // Exactly what production reported: 29 characters short, header gone,
    // footer and base64 body intact.
    const noHeader = escaped.replace("-----BEGIN PRIVATE KEY-----\\n", "");
    expect(noHeader.length).toBe(escaped.length - 29);
    expect(parses(normalisePrivateKey(noHeader)), "missing header should parse").toBe(true);

    const noFooter = escaped.replace("\\n-----END PRIVATE KEY-----", "");
    expect(parses(normalisePrivateKey(noFooter)), "missing footer should parse").toBe(true);
  });

  it("cannot invent a key that was truncated", () => {
    // Nothing can repair missing bytes — this must fail loudly, not silently.
    const truncated = PEM.slice(0, Math.floor(PEM.length / 2));
    expect(parses(normalisePrivateKey(truncated))).toBe(false);
  });
});

describe("describePrivateKey", () => {
  it("reports shape without leaking the key", () => {
    const description = describePrivateKey(PEM);
    expect(description).toContain("header=true");
    expect(description).toContain("footer=true");
    expect(description).toContain("bodyIsBase64=true");
    // No fragment of the secret may appear in something written to a log.
    const body = PEM.replace(/-----[A-Z ]+-----/g, "").replace(/\s/g, "");
    expect(description).not.toContain(body.slice(0, 24));
  });

  it("flags a truncated paste as missing its footer", () => {
    expect(describePrivateKey(PEM.slice(0, 200))).toContain("footer=false");
  });
});
