import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ProductSelector,
  productMatchesSearch,
  productOptionLabel,
  type ProductSelectorOption,
} from "./product-selector";

const product: ProductSelectorOption = {
  id: "09fdd4db-0b2f-48fc-889b-88631d20a9ed",
  name: "Lounge Chair",
  sku: "CHR-104",
  stock: "8",
  inventoryUnit: { code: "PCS" },
};

describe("product selector", () => {
  it("builds a user-facing label without the internal id", () => {
    expect(productOptionLabel(product)).toBe("Lounge Chair \u2014 CHR-104 (PCS)");
    expect(productOptionLabel(product)).not.toContain(product.id);
  });

  it("searches by product name and SKU without case sensitivity", () => {
    expect(productMatchesSearch(product, "lounge")).toBe(true);
    expect(productMatchesSearch(product, "chr-104")).toBe(true);
    expect(productMatchesSearch(product, "table")).toBe(false);
  });

  it("renders the selected product label with stock and a bounded dropdown", () => {
    const html = renderToStaticMarkup(
      createElement(ProductSelector, {
        id: "product-0",
        value: product.id,
        products: [product],
        onChange: () => undefined,
      }),
    );

    expect(html).toContain("Lounge Chair — CHR-104 (PCS)");
    expect(html).toContain("Current stock: 8 PCS");
    expect(html).toContain("top-full");
    expect(html).toContain("max-h-72");
  });
});
