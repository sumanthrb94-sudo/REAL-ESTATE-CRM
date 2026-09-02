// Markets: the per-country facts creative depends on.
//
// A "from ₹88 L" headline is meaningless in Dubai, and "RERA P02400001234"
// is meaningless in Austin. Templates never format money or name a regulator
// themselves; they read it from the brief, which reads it from here. Adding a
// market is one row, not a template rewrite.

export interface Market {
  id: string;
  /** BCP-47 locale used for number formatting. */
  locale: string;
  /** ISO 4217 currency code. */
  currency: string;
  /** Regulator whose registration number appears on every creative, if any. */
  regulator?: string;
  areaUnit: "sq ft" | "sq m";
  /** Default narration language, as an ElevenLabs/ISO 639-1 code. */
  language: string;
}

export const MARKETS = {
  IN: { id: "IN", locale: "en-IN", currency: "INR", regulator: "RERA", areaUnit: "sq ft", language: "en" },
  AE: { id: "AE", locale: "en-AE", currency: "AED", regulator: "DLD", areaUnit: "sq ft", language: "en" },
  GB: { id: "GB", locale: "en-GB", currency: "GBP", areaUnit: "sq ft", language: "en" },
  US: { id: "US", locale: "en-US", currency: "USD", areaUnit: "sq ft", language: "en" },
  SG: { id: "SG", locale: "en-SG", currency: "SGD", regulator: "URA", areaUnit: "sq ft", language: "en" },
  AU: { id: "AU", locale: "en-AU", currency: "AUD", areaUnit: "sq m", language: "en" },
} as const satisfies Record<string, Market>;

export type MarketId = keyof typeof MARKETS;

export const DEFAULT_MARKET: MarketId = "IN";

export function isMarketId(value: string): value is MarketId {
  return Object.prototype.hasOwnProperty.call(MARKETS, value);
}

/** The market a brief is built for: an explicit id, else CONTENT_MARKET, else India. */
export function resolveMarket(id?: string | null): Market {
  const candidate = id ?? process.env.CONTENT_MARKET ?? DEFAULT_MARKET;
  return MARKETS[isMarketId(candidate) ? candidate : DEFAULT_MARKET];
}

/**
 * Headline money. India counts in lakh and crore, which Intl does not know;
 * everywhere else a compact currency figure ("AED 1.5M", "$920K") reads
 * naturally on a slide.
 */
export function formatMoney(amount: number, market: Market): string {
  if (market.currency === "INR") {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
    if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
  }
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currency,
    notation: "compact",
    maximumFractionDigits: amount >= 1_000_000 ? 1 : 0,
  }).format(amount);
}

export function formatArea(value: number, market: Market): string {
  return `${value.toLocaleString(market.locale)} ${market.areaUnit}`;
}

/**
 * Money as a narrator says it. "₹1.38 Cr" on a slide is "1.38 crore" out
 * loud; "AED 1.5M" is "1,500,000 UAE dirhams". Speech models read currency
 * names reliably and symbols unreliably.
 */
export function spokenMoney(amount: number, market: Market): string {
  if (market.currency === "INR") {
    if (amount >= 10_000_000) return `${trimZeros((amount / 10_000_000).toFixed(2))} crore`;
    if (amount >= 100_000) return `${trimZeros((amount / 100_000).toFixed(2))} lakh`;
    return `${amount.toLocaleString("en-IN")} rupees`;
  }
  return new Intl.NumberFormat(market.locale, {
    style: "currency",
    currency: market.currency,
    currencyDisplay: "name",
    maximumFractionDigits: 0,
  }).format(amount);
}

function trimZeros(fixed: string): string {
  return fixed.replace(/\.?0+$/, "");
}
