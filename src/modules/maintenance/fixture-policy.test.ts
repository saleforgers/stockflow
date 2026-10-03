import { describe, expect, it } from "vitest";
import { isDemoTestActor, isDemoProduct } from "./fixture-policy";
const uuid = "a02334a6-54c0-4bd1-b98f-6d6ce8a5f9ba";
describe("recognized automated fixture policy", () => {
  it("requires an exact marker and generated test-only email", () => {
    expect(isDemoTestActor(`P3-IT-${uuid}`, `${uuid}@example.test`)).toBe(true);
    expect(isDemoTestActor(`EXP-IT-${uuid}`, `${uuid}@example.test`)).toBe(true);
    expect(isDemoTestActor("Demo acceptance", `${uuid}@example.test`)).toBe(true);
    for (const [name, email] of [
      ["Demo", `${uuid}@example.test`],
      [`P3-IT-${uuid}`, "owner@example.com"],
      ["Demo acceptance", "admin@example.test"],
      [`P3-IT-${uuid}-real`, `${uuid}@example.test`],
    ])
      expect(isDemoTestActor(name!, email!)).toBe(false);
  });
  it("does not select ordinary demo-named products or arbitrary SKUs", () => {
    expect(isDemoProduct("Demo acceptance", uuid)).toBe(true);
    expect(isDemoProduct(`P3-IT-${uuid}`, `P3-IT-${uuid}-${uuid}`)).toBe(true);
    expect(isDemoProduct("Demo acceptance", "IRON-001")).toBe(false);
    expect(isDemoProduct("Demo", "IRON-001")).toBe(false);
    expect(isDemoProduct(`P3-IT-${uuid}`, "REAL-001")).toBe(false);
  });
});
