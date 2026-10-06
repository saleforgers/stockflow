import { describe, expect, it } from "vitest";

import { newInvoiceCommand } from "./defaults";

describe("newInvoiceCommand", () => {
  it("uses a non-submittable customer placeholder on a new invoice", () => {
    const command = newInvoiceCommand("2026-10-06", "request-key");

    expect(command.customerId).toBe("");
  });
});
