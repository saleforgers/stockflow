import { describe, expect, it } from "vitest";

import { recentPartyIds } from "./recent";
import { appendParty, withSelectedParty } from "./selection";
import { invoiceDraftSchema } from "@/modules/sales/validation";
import { purchaseDraftCommandSchema } from "@/modules/purchases/validation";

describe("party selector helpers", () => {
  it("returns five distinct recent parties and excludes obvious integration fixtures", () => {
    const parties = [
      { id: "test", name: "P3-IT-generated" },
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `party-${index}`,
        name: `Party ${index}`,
      })),
    ];
    const history = [
      { partyId: "test" },
      { partyId: "party-0" },
      { partyId: "party-0" },
      { partyId: "party-1" },
      { partyId: "party-2" },
      { partyId: "party-3" },
      { partyId: "party-4" },
      { partyId: "party-5" },
    ];

    expect(recentPartyIds(history, parties)).toEqual([
      "party-0",
      "party-1",
      "party-2",
      "party-3",
      "party-4",
    ]);
  });

  it("selects an added party without clearing transaction form state", () => {
    const invoice = {
      customerId: "",
      invoiceDate: "2026-10-06",
      notes: "keep this",
      lines: [{ productId: "product", quantity: "2" }],
    };
    const next = withSelectedParty(invoice, "customerId", "new-customer");

    expect(next).toEqual({ ...invoice, customerId: "new-customer" });
    expect(appendParty([{ id: "existing" }], { id: "new-customer" })).toEqual([
      { id: "existing" },
      { id: "new-customer" },
    ]);

    const purchase = {
      supplierId: "",
      purchaseDate: "2026-10-06",
      notes: "keep purchase notes",
      lots: [{ lines: [{ productId: "product", quantity: "4" }] }],
    };
    expect(withSelectedParty(purchase, "supplierId", "new-supplier")).toEqual({
      ...purchase,
      supplierId: "new-supplier",
    });
  });

  it("does not accept customer or supplier placeholder values server-side", () => {
    expect(
      invoiceDraftSchema.safeParse({
        customerId: "",
        invoiceDate: "2026-10-06",
        invoiceDiscountAmount: "0",
        lines: [],
      }).success,
    ).toBe(false);
    expect(
      purchaseDraftCommandSchema.safeParse({
        supplierId: "",
        purchaseDate: "2026-10-06",
        additionalCharges: "0",
        lots: [],
      }).success,
    ).toBe(false);
  });
});
