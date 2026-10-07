import type { ReactNode } from "react";

export function DocumentHeading({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="document-heading">
      <div>
        <p className="document-eyebrow">StockFlow · PKR</p>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export function InvoiceGridHeading({ priceLabel }: { priceLabel: string }) {
  return (
    <div className="invoice-grid-heading" aria-hidden="true">
      <span>Product / SKU</span>
      <span>Quantity</span>
      <span>{priceLabel}</span>
      <span>Discount (PKR)</span>
      <span>Amount (PKR)</span>
      <span />
    </div>
  );
}

export function DocumentTotals({
  children,
  title = "Invoice summary",
  className,
  hideTitle = false,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
  hideTitle?: boolean;
}) {
  return (
    <section className={className ?? "document-totals"} aria-label={title}>
      {!hideTitle && <h2 className="document-eyebrow mb-4">{title}</h2>}
      {children}
    </section>
  );
}
