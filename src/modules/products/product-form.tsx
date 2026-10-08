"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";

type Option = { id: string; name: string };
type ProductValue = {
  sku: string;
  name: string;
  description: string | null;
  categoryId: string;
  inventoryUnitId: string;
  preferredSupplierId: string | null;
  defaultPurchasePrice: string | null;
  defaultSellingPrice: string | null;
  lowStockThreshold: string;
  specifications: Array<{ key: string; value: string }>;
};

export function ProductForm({
  action,
  product,
  categories,
  units,
  suppliers,
  currentStock,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  product?: ProductValue;
  categories: Option[];
  units: Array<Option & { code: string; decimalScale: number }>;
  suppliers: Option[];
  currentStock?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});
  const [specifications, setSpecifications] = useState(
    product?.specifications.length ? product.specifications : [{ key: "", value: "" }],
  );
  const inventoryUnit = units.find((unit) => unit.id === product?.inventoryUnitId);
  return (
    <form action={formAction} className="card max-w-4xl space-y-6 p-6">
      <FormMessage result={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          htmlFor="sku"
          error={fieldErrors["sku"]?.[0]}
          label="SKU"
          hint="Stored in normalized uppercase form."
          required
        >
          <input
            className="input"
            defaultValue={product?.sku}
            id="sku"
            maxLength={64}
            name="sku"
            required
          />
        </FormField>
        <FormField htmlFor="name" error={fieldErrors["name"]?.[0]} label="Product name" required>
          <input
            className="input"
            defaultValue={product?.name}
            id="name"
            maxLength={160}
            name="name"
            required
          />
        </FormField>
        <FormField
          htmlFor="categoryId"
          error={fieldErrors["categoryId"]?.[0]}
          label="Category"
          required
        >
          <select
            className="input"
            defaultValue={product?.categoryId ?? ""}
            id="categoryId"
            name="categoryId"
            required
          >
            <option disabled value="">
              Select category
            </option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          htmlFor="inventoryUnitId"
          error={fieldErrors["inventoryUnitId"]?.[0]}
          label="Inventory unit"
          required
        >
          <select
            className="input"
            defaultValue={product?.inventoryUnitId ?? ""}
            id="inventoryUnitId"
            name="inventoryUnitId"
            required
          >
            <option disabled value="">
              Select unit
            </option>
            {units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.name} ({item.decimalScale} decimals)
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          htmlFor="preferredSupplierId"
          error={fieldErrors["preferredSupplierId"]?.[0]}
          label="Preferred supplier"
        >
          <select
            className="input"
            defaultValue={product?.preferredSupplierId ?? ""}
            id="preferredSupplierId"
            name="preferredSupplierId"
          >
            <option value="">None</option>
            {suppliers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          htmlFor="lowStockThreshold"
          error={fieldErrors["lowStockThreshold"]?.[0]}
          label="Low-stock threshold"
          hint="Validated against the selected unit's decimal scale."
          required
        >
          <input
            className="input"
            defaultValue={product?.lowStockThreshold ?? "0"}
            id="lowStockThreshold"
            inputMode="decimal"
            name="lowStockThreshold"
            required
          />
        </FormField>
        <FormField
          htmlFor="defaultPurchasePrice"
          error={fieldErrors["defaultPurchasePrice"]?.[0]}
          label="Default purchase price (PKR)"
          hint="Optional convenience value; not historical cost."
        >
          <input
            className="input"
            defaultValue={product?.defaultPurchasePrice ?? ""}
            id="defaultPurchasePrice"
            inputMode="decimal"
            name="defaultPurchasePrice"
          />
        </FormField>
        {!product ? (
          <FormField
            htmlFor="openingStockQuantity"
            error={fieldErrors["openingStockQuantity"]?.[0]}
            label="Opening Stock Quantity"
            hint="Optional. Uses the Default Purchase Price as opening unit cost; a positive price is required when opening stock is greater than zero."
          >
            <input
              className="input"
              defaultValue="0"
              id="openingStockQuantity"
              inputMode="decimal"
              min="0"
              name="openingStockQuantity"
            />
          </FormField>
        ) : null}
        <FormField
          htmlFor="defaultSellingPrice"
          error={fieldErrors["defaultSellingPrice"]?.[0]}
          label="Default selling price (PKR)"
          hint="Optional convenience value; invoice lines later preserve actual prices."
        >
          <input
            className="input"
            defaultValue={product?.defaultSellingPrice ?? ""}
            id="defaultSellingPrice"
            inputMode="decimal"
            name="defaultSellingPrice"
          />
        </FormField>
        {product ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current Stock
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <strong className="text-lg text-slate-900">
                {currentStock ?? "0"} {inventoryUnit?.code ?? ""}
              </strong>
              <Link className="btn-secondary" href="/inventory/adjust">
                Adjust Stock
              </Link>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Existing stock is changed through auditable inventory adjustments, purchases, and
              returns.
            </p>
          </div>
        ) : null}
      </div>
      <FormField htmlFor="description" error={fieldErrors["description"]?.[0]} label="Description">
        <textarea
          className="input min-h-28"
          defaultValue={product?.description ?? ""}
          id="description"
          maxLength={2000}
          name="description"
        />
      </FormField>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-900">Specifications</legend>
        <p className="text-xs text-slate-500">
          Add only attributes relevant to this SKU. Keys are normalized on the server.
        </p>
        {specifications.map((row, index) => (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" key={index}>
            <input
              aria-label={`Specification ${index + 1} attribute`}
              className="input"
              name="specKey"
              placeholder="Attribute (e.g. Material)"
              value={row.key}
              onChange={(event) =>
                setSpecifications((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, key: event.target.value } : item,
                  ),
                )
              }
            />
            <input
              aria-label={`Specification ${index + 1} value`}
              className="input"
              name="specValue"
              placeholder="Value (e.g. Mild Steel)"
              value={row.value}
              onChange={(event) =>
                setSpecifications((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, value: event.target.value } : item,
                  ),
                )
              }
            />
            <button
              className="btn-secondary"
              disabled={specifications.length === 1}
              onClick={() => setSpecifications((current) => current.filter((_, i) => i !== index))}
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="btn-secondary"
          onClick={() => setSpecifications((current) => [...current, { key: "", value: "" }])}
          type="button"
        >
          Add specification
        </button>
      </fieldset>
      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <SubmitButton />
        <Link className="btn-secondary" href={product ? "/products" : "/products"}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
