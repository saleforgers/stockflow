import { describe, expect, it } from "vitest";

import { adminRecoverySchema } from "./validation";

describe("admin credential recovery validation", () => {
  it("normalizes the Admin email and accepts a sufficiently long password", () => {
    const result = adminRecoverySchema.parse({
      email: "  Admin@StockFlow.com ",
      password: "a-secure-recovery-password",
    });

    expect(result.email).toBe("admin@stockflow.com");
  });

  it("rejects short recovery passwords", () => {
    expect(() =>
      adminRecoverySchema.parse({ email: "admin@stockflow.com", password: "too-short" }),
    ).toThrow("at least 12");
  });
});
