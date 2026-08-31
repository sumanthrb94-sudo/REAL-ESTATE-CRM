import { NextResponse, type NextRequest } from "next/server";

/**
 * Security response headers, with a per-request nonce for the CSP.
 *
 * The app shipped with none of these. A CRM holding customer names, phone
 * numbers and budgets is worth framing, sniffing and injecting into, so the
 * defaults matter.
 *
 * script-src uses a nonce rather than 'unsafe-inline' because Next injects the
 * RSC payload as inline scripts; a nonce lets those run while still refusing
 * anything an attacker manages to inject. 'strict-dynamic' lets Next's own
 * bootstrap load its chunks. style-src has to allow inline styles — Recharts
 * sets them as element style attributes — which is a far smaller exposure than
 * allowing inline script.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    `default-src 'self'`,
    // 'unsafe-eval' is only tolerated in development, where React's refresh
    // runtime needs it. Production gets no eval at all.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    // The app talks only to its own origin; Firestore is reached server-side.
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  // Next reads the nonce off the request headers and stamps it onto the
  // scripts it renders, so it has to be set here as well as on the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("content-security-policy", csp);
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  response.headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, which are served straight from the CDN
    // and gain nothing from a per-request nonce.
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
