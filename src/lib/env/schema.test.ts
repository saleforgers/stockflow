import { describe, expect, it } from "vitest";

import { parseDatabaseAdministrationEnvironment, parseServerEnvironment } from "./schema";

describe("server environment validation", () => {
  it("accepts a PostgreSQL connection URL", () => {
    const result = parseServerEnvironment({
      DATABASE_URL: "postgresql://user:password@localhost:5432/stockflow",
    });

    expect(result.DATABASE_URL).toContain("stockflow");
  });

  it("rejects missing and non-PostgreSQL URLs", () => {
    expect(() => parseServerEnvironment({})).toThrow("DATABASE_URL is required");
    expect(() => parseServerEnvironment({ DATABASE_URL: "https://example.com" })).toThrow(
      "PostgreSQL protocol",
    );
  });

  it("validates the separate Prisma migration connection", () => {
    const result = parseDatabaseAdministrationEnvironment({
      DIRECT_URL: "postgresql://user:password@localhost:5432/stockflow",
    });

    expect(result.DIRECT_URL).toContain("stockflow");
    expect(() => parseDatabaseAdministrationEnvironment({})).toThrow("DIRECT_URL is required");
    expect(() =>
      parseDatabaseAdministrationEnvironment({ DIRECT_URL: "https://example.com" }),
    ).toThrow("PostgreSQL protocol");
  });
});
