import { describe, expect, it } from "vitest";

import { ApplicationError } from "@/lib/errors/application-error";

import { assertMasterDataAdmin, assertRole, type AuthorizedUser } from "./authorization";

const user = (role: AuthorizedUser["role"], isActive = true): AuthorizedUser => ({
  id: "00000000-0000-4000-8000-000000000010",
  name: "Test User",
  email: "test@example.test",
  role,
  isActive,
});

describe("authorization policy", () => {
  it("allows Admin master-data mutations", () => {
    expect(() => assertMasterDataAdmin(user("ADMIN"))).not.toThrow();
  });

  it("denies Manager and Staff master-data mutations", () => {
    expect(() => assertMasterDataAdmin(user("MANAGER"))).toThrow(ApplicationError);
    expect(() => assertMasterDataAdmin(user("STAFF"))).toThrow("permission");
  });

  it("denies inactive users regardless of role", () => {
    expect(() => assertRole(user("ADMIN", false), ["ADMIN"])).toThrow("inactive");
  });
});
