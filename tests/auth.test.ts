import { describe, expect, it } from "vitest";
import { hashPassword, hashPasswordSync, needsRehash, verifyPassword } from "@/server/auth/password";
import { createSessionToken, verifySessionToken, SESSION_TTL_MS } from "@/server/auth/token";
import { can, permissionsFor } from "@/server/auth/rbac";
import { ROLES } from "@/types/domain";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("Correct horse battery staple", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts, so the same password hashes differently every time", async () => {
    const a = await hashPassword("same-password-here");
    const b = await hashPassword("same-password-here");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password-here", a)).toBe(true);
    expect(await verifyPassword("same-password-here", b)).toBe(true);
  });

  it("treats a missing or malformed hash as a failed login, not a crash", async () => {
    expect(await verifyPassword("anything", undefined)).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$1$2$3")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$1$2$3$aaaa$bbbb")).toBe(false);
    // Well-formed shape, garbage parameters.
    expect(await verifyPassword("anything", "scrypt$x$y$z$aaaa$bbbb")).toBe(false);
  });

  it("produces sync and async hashes that verify interchangeably", async () => {
    const sync = hashPasswordSync("bootstrap-password");
    expect(await verifyPassword("bootstrap-password", sync)).toBe(true);
    expect(needsRehash(sync)).toBe(false);
  });

  it("flags hashes made with weaker parameters for rehash", () => {
    expect(needsRehash("scrypt$1024$8$1$c2FsdA==$aGFzaA==")).toBe(true);
    expect(needsRehash("not-a-hash")).toBe(true);
  });
});

describe("session tokens", () => {
  it("round-trips a user id", () => {
    const token = createSessionToken("usr_admin");
    expect(verifySessionToken(token)?.sub).toBe("usr_admin");
  });

  it("rejects a token whose payload was edited", () => {
    // This is the exact attack the old unsigned cookie allowed: swap the
    // subject to another user's id and become them.
    const token = createSessionToken("usr_agent");
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "usr_admin", iat: Date.now(), exp: Date.now() + 1000 }),
    ).toString("base64url");

    expect(verifySessionToken(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token with a tampered signature", () => {
    const token = createSessionToken("usr_admin");
    const [payload] = token.split(".");
    expect(verifySessionToken(`${payload}.aaaabbbbcccc`)).toBeNull();
  });

  it("rejects malformed tokens without throwing", () => {
    for (const bad of ["", "no-dot", ".", "a.", ".b", "....", "%%%.%%%"]) {
      expect(verifySessionToken(bad)).toBeNull();
    }
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it("rejects an expired token", () => {
    const issued = Date.now() - SESSION_TTL_MS - 1000;
    const token = createSessionToken("usr_admin", issued);
    expect(verifySessionToken(token)).toBeNull();
    // Still valid when checked at the time it was issued.
    expect(verifySessionToken(token, issued + 1000)?.sub).toBe("usr_admin");
  });
});

describe("rbac matrix", () => {
  it("gives ADMIN every permission", () => {
    expect(permissionsFor("ADMIN")).toContain("user.manage");
    expect(can("ADMIN", "settings.write")).toBe(true);
  });

  it("withholds marketing and reports from a sales agent", () => {
    expect(can("SALES_AGENT", "marketing.read")).toBe(false);
    expect(can("SALES_AGENT", "report.read")).toBe(false);
    expect(can("SALES_AGENT", "lead.assign")).toBe(false);
    expect(can("SALES_AGENT", "lead.read")).toBe(true);
  });

  it("gives no role but ADMIN the ability to manage users", () => {
    for (const role of ROLES) {
      expect(can(role, "user.manage")).toBe(role === "ADMIN");
    }
  });

  it("never grants a write permission without its matching read", () => {
    const pairs = [
      ["lead.write", "lead.read"],
      ["inventory.write", "inventory.read"],
      ["booking.write", "booking.read"],
      ["marketing.write", "marketing.read"],
      ["partner.write", "partner.read"],
    ] as const;

    for (const role of ROLES) {
      for (const [write, read] of pairs) {
        if (can(role, write)) {
          expect(can(role, read), `${role} has ${write} but not ${read}`).toBe(true);
        }
      }
    }
  });

  it("returns nothing for an unknown role rather than throwing", () => {
    // @ts-expect-error — deliberately outside the Role union.
    expect(can("SUPERUSER", "lead.read")).toBe(false);
  });
});
