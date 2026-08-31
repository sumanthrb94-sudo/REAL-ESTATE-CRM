// Normalising a service-account private key pasted into a hosting dashboard.
//
// The PEM in a Firebase service-account JSON is a multi-line value carried as
// a single line with "\n" escapes. Getting that intact through a dashboard
// field is where deployments go wrong, and every failure produces the same
// opaque message from OpenSSL:
//
//   Failed to parse private key: error:1E08010C:DECODER routines::unsupported
//
// Rather than ask someone to re-paste and hope, reconstruct the PEM from the
// manglings that actually occur: wrapping quotes copied along with the JSON
// value, "\n" left literal or double-escaped, and newlines stripped entirely
// so the whole key arrives as one run of base64.

const HEADER = "-----BEGIN PRIVATE KEY-----";
const FOOTER = "-----END PRIVATE KEY-----";
const RSA_HEADER = "-----BEGIN RSA PRIVATE KEY-----";
const RSA_FOOTER = "-----END RSA PRIVATE KEY-----";

/** PEM bodies wrap at 64 characters. */
const WRAP = 64;

export function normalisePrivateKey(raw: string): string {
  let key = raw.trim();

  // A value copied straight out of the JSON keeps its quotes.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // Shells and some dashboards double-escape, so collapse "\\n" before "\n".
  key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  const header = key.includes(RSA_HEADER) ? RSA_HEADER : HEADER;
  const footer = key.includes(RSA_FOOTER) ? RSA_FOOTER : FOOTER;
  if (!key.includes(header) || !key.includes(footer)) return key;

  // Re-wrap from the base64 between the markers. This repairs a key whose
  // newlines were lost entirely, and is a no-op on a well-formed one.
  const body = key
    .slice(key.indexOf(header) + header.length, key.indexOf(footer))
    .replace(/[\s]/g, "");
  if (!body) return key;

  const lines: string[] = [];
  for (let i = 0; i < body.length; i += WRAP) lines.push(body.slice(i, i + WRAP));
  return `${header}\n${lines.join("\n")}\n${footer}\n`;
}

/**
 * Describes a key's shape without ever revealing it, so a failure in a log
 * says which mangling occurred instead of just "unsupported".
 */
export function describePrivateKey(raw: string): string {
  const normalised = normalisePrivateKey(raw);
  const hasHeader = normalised.includes(HEADER) || normalised.includes(RSA_HEADER);
  const hasFooter = normalised.includes(FOOTER) || normalised.includes(RSA_FOOTER);
  const body = normalised
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s/g, "");
  const looksBase64 = /^[A-Za-z0-9+/=]*$/.test(body);
  return [
    `rawChars=${raw.length}`,
    `normalisedChars=${normalised.length}`,
    `bodyChars=${body.length}`,
    `header=${hasHeader}`,
    `footer=${hasFooter}`,
    `bodyIsBase64=${looksBase64}`,
  ].join(" ");
}
