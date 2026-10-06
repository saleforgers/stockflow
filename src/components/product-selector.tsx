"use client";

import { useMemo, useRef, useState } from "react";

export type ProductSelectorOption = {
  id: string;
  name: string;
  sku: string;
  stock?: string;
  inventoryUnit: { code: string };
};

export function productOptionLabel(product: ProductSelectorOption) {
  return `${product.name} \u2014 ${product.sku} (${product.inventoryUnit.code})`;
}

export function productMatchesSearch(product: ProductSelectorOption, search: string) {
  const query = search.trim().toLowerCase();
  return (
    !query ||
    product.name.toLowerCase().includes(query) ||
    product.sku.toLowerCase().includes(query)
  );
}

function ProductOptionButton({
  product,
  onSelect,
}: {
  product: ProductSelectorOption;
  onSelect: () => void;
}) {
  return (
    <button
      className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100"
      type="button"
      onClick={onSelect}
    >
      <span className="block truncate text-sm font-medium text-slate-900">
        {productOptionLabel(product)}
      </span>
      {product.stock !== undefined ? (
        <span className="mt-0.5 block text-xs text-slate-500">
          Current stock: {product.stock} {product.inventoryUnit.code}
        </span>
      ) : null}
    </button>
  );
}

export function ProductSelector({
  id,
  value,
  products,
  onChange,
  required = true,
}: {
  id: string;
  value: string;
  products: ProductSelectorOption[];
  onChange: (id: string) => void;
  required?: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState("");
  const selected = products.find((product) => product.id === value);
  const matches = useMemo(
    () => products.filter((product) => productMatchesSearch(product, search)),
    [products, search],
  );

  const select = (product: ProductSelectorOption) => {
    onChange(product.id);
    details.current?.removeAttribute("open");
    setSearch("");
  };

  return (
    <details className="group relative open:z-40" ref={details}>
      <summary
        aria-required={required}
        className="input flex cursor-pointer list-none items-center justify-between"
        id={id}
      >
        <span
          className={`min-w-0 flex-1 truncate pr-4 ${
            selected ? "text-slate-900" : "text-slate-500"
          }`}
        >
          {selected ? productOptionLabel(selected) : "Select product"}
        </span>
        <svg
          aria-hidden="true"
          className="ml-2 size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="absolute top-full left-0 z-40 mt-2 w-full min-w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <input
          aria-label="Search products by name or SKU"
          autoComplete="off"
          className="input mb-2"
          placeholder="Search by product name or SKU"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-72 overflow-y-auto">
          {matches.map((product) => (
            <ProductOptionButton
              key={product.id}
              product={product}
              onSelect={() => select(product)}
            />
          ))}
          {!matches.length ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">No matching products.</p>
          ) : null}
        </div>
      </div>
    </details>
  );
}
