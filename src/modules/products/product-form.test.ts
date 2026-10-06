import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";

import { ProductForm } from "./product-form";

const options = {
  categories: [{ id: "category", name: "Furniture" }],
  units: [{ id: "unit", name: "Piece", code: "PCS", decimalScale: 0 }],
  suppliers: [],
};
const action = async () => INITIAL_ACTION_RESULT;

describe("ProductForm stock fields", () => {
  it("shows opening stock only when creating a product", () => {
    const html = renderToStaticMarkup(createElement(ProductForm, { action, ...options }));

    expect(html).toContain("Opening Stock Quantity");
    expect(html).toContain('name="openingStockQuantity"');
    expect(html).not.toContain("Adjust Stock");
  });

  it("shows current stock and Adjust Stock without an editable opening field", () => {
    const html = renderToStaticMarkup(
      createElement(ProductForm, {
        action,
        ...options,
        currentStock: "12",
        product: {
          sku: "CHAIR-001",
          name: "Chair",
          description: null,
          categoryId: "category",
          inventoryUnitId: "unit",
          preferredSupplierId: null,
          defaultPurchasePrice: "1000",
          defaultSellingPrice: "1500",
          lowStockThreshold: "2",
          specifications: [],
        },
      }),
    );

    expect(html).toContain("Current Stock");
    expect(html).toContain("12");
    expect(html).toContain("Adjust Stock");
    expect(html).not.toContain('name="openingStockQuantity"');
  });
});
