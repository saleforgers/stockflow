import Decimal from "decimal.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";

import { InvoiceForm, invoicePaymentType, PostInvoiceForm } from "./forms";

describe("sales invoice payment controls", () => {
  it("classifies credit, partial, and paid amounts explicitly", () => {
    const total = new Decimal("100");

    expect(invoicePaymentType(total, "0")).toBe("CREDIT");
    expect(invoicePaymentType(total, "25")).toBe("PARTIAL");
    expect(invoicePaymentType(total, "100")).toBe("PAID");
  });

  it("renders one Save Draft action and one Finalize Invoice action", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceForm, {
        action: async () => INITIAL_ACTION_RESULT,
        customers: [
          {
            id: "00000000-0000-4000-8000-000000000010",
            name: "Named Customer",
            phone: null,
            isWalkIn: false,
            accountBalance: "0.00",
          },
        ],
        products: [
          {
            id: "00000000-0000-4000-8000-000000000020",
            name: "Chair",
            sku: "CHAIR-001",
            defaultSellingPrice: "100",
            available: "5",
            inventoryUnit: { code: "PCS", decimalScale: 0 },
          },
        ],
        methods: [{ id: "00000000-0000-4000-8000-000000000030", name: "Cash" }],
        date: "2026-10-06",
        requestKey: "00000000-0000-4000-8000-000000000040",
        initial: {
          requestKey: "00000000-0000-4000-8000-000000000040",
          customerId: "00000000-0000-4000-8000-000000000010",
          invoiceDate: "2026-10-06",
          invoiceDiscountAmount: "0",
          notes: "",
          lines: [
            {
              productId: "00000000-0000-4000-8000-000000000020",
              quantity: "1",
              unitPrice: "100",
              lineDiscountAmount: "0",
            },
          ],
        },
      }),
    );

    expect(html.match(/Save Draft/g)).toHaveLength(1);
    expect(html.match(/Finalize Invoice/g)).toHaveLength(1);
    expect(html).toContain('name="paymentType"');
    expect(html).toContain('<option value="CREDIT" selected="">Credit</option>');
    expect(html).toContain('<option value="PAID">Paid</option>');
    expect(html).toContain('<option value="PARTIAL">Partial payment</option>');
    expect(html).toContain('formNoValidate=""');
  });

  it("forces full payment for a walk-in draft without permitting credit selection", () => {
    const html = renderToStaticMarkup(
      createElement(PostInvoiceForm, {
        action: async () => INITIAL_ACTION_RESULT,
        methods: [{ id: "00000000-0000-4000-8000-000000000030", name: "Cash" }],
        total: "125.50",
        walkIn: true,
      }),
    );
    expect(html).toContain('name="paymentType" value="PAID"');
    expect(html).toContain('name="amount" value="125.50"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('name="paymentMethodId" required=""');
  });
});
