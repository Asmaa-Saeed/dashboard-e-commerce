import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMoney } from "@/lib/format";
import { recordStockMovement, setProductOutOfStock, setVariantOutOfStock } from "../actions";
import { MOVEMENT_KINDS } from "../labels";
import type { ProductRow } from "../queries";

type Props = { product: ProductRow; storeId: string; currencySymbol: string; countsStock: boolean };

export function ProductCard({ product, storeId, currencySymbol, countsStock }: Props) {
  const variants = product.product_variants.filter((v) => v.in_feed);
  const showVariants = variants.length > 1 || countsStock;
  const image = product.thumbnail_url ?? product.image_url;

  return (
    <li className="flex flex-col gap-3 border-b border-line p-4 last:border-0">
      <div className="flex flex-wrap gap-3 sm:flex-nowrap">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- photos live on each store's own site
          <img src={image} alt="" width={72} height={72} loading="lazy" className="size-[72px] shrink-0 rounded-control border border-line object-cover" />
        ) : (
          <span className="size-[72px] shrink-0 rounded-control bg-surface-muted" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {product.url ? (
              <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold text-ink hover:text-primary-ink">
                {product.name}
              </a>
            ) : (
              <span className="text-[15px] font-semibold text-ink">{product.name}</span>
            )}
            <span className="text-[12px] text-subtle tabular">#{product.external_id}</span>
          </div>
          <p className="mt-0.5 text-[15px] font-semibold text-primary-ink tabular">
            {formatMoney(product.price, currencySymbol)}
            {product.max_price && product.max_price !== product.price ? ` - ${formatMoney(product.max_price, currencySymbol)}` : ""}
            {product.original_price && product.price && product.original_price > product.price ? (
              <span className="ms-2 text-[13px] font-normal text-subtle line-through">{formatMoney(product.original_price, currencySymbol)}</span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {product.out_of_stock ? <Badge tone="neutral">نفدت الكمية</Badge> : <Badge tone="success">متوفر</Badge>}
          </div>
        </div>
        <div className="flex w-full shrink-0 gap-2 sm:w-40 sm:flex-col">
          <ActionForm action={setProductOutOfStock} hiddenFields={{ storeId, productId: product.id, value: String(!product.out_of_stock) }} className="flex-1">
            <SubmitButton variant={product.out_of_stock ? "primary" : "outline"} size="sm" className="w-full">
              {product.out_of_stock ? "أصبح متوفرًا" : "نفدت الكمية"}
            </SubmitButton>
          </ActionForm>
        </div>
      </div>

      {showVariants ? (
        <div className="overflow-x-auto rounded-control border border-line">
          <table className="w-full min-w-[480px] text-[13px]">
            <thead className="bg-canvas text-[12px] text-muted">
              <tr>
                <th className="px-3 py-2 text-right font-semibold">النوع</th>
                <th className="px-3 py-2 text-right font-semibold">السعر</th>
                {countsStock ? <th className="px-3 py-2 text-right font-semibold">الكمية</th> : null}
                <th className="px-3 py-2 text-right font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => {
                const low = countsStock && v.stock_qty !== null && v.stock_qty > 0 && v.stock_qty <= v.low_stock_threshold;
                return (
                  <tr key={v.id} className="border-t border-line align-top">
                    <td className="px-3 py-2">{v.label ?? ([v.color, v.size].filter(Boolean).join(" / ") || "الأساسي")}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular">{formatMoney(v.price, currencySymbol)}</td>
                    {countsStock ? (
                      <td className="px-3 py-2">
                        <span className={low ? "font-semibold text-warning tabular" : "tabular"}>{v.stock_qty ?? "لم يُحسب"}</span>
                        {low ? <span className="ms-1 text-[11px] font-semibold text-warning">قارب على النفاد</span> : null}
                        <StockForm storeId={storeId} variantId={v.id} />
                      </td>
                    ) : null}
                    <td className="px-3 py-2">
                      <ActionForm action={setVariantOutOfStock} hiddenFields={{ storeId, variantId: v.id, value: String(!v.out_of_stock) }} className="flex items-center gap-2">
                        <Badge tone={v.out_of_stock ? "neutral" : "success"}>{v.out_of_stock ? "نفد" : "متوفر"}</Badge>
                        <SubmitButton variant="ghost" size="sm" className="h-8 px-2">
                          {v.out_of_stock ? "متوفر" : "نفد"}
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </li>
  );
}

function StockForm({ storeId, variantId }: { storeId: string; variantId: string }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-[12px] font-semibold text-primary-ink">تعديل الكمية</summary>
      <ActionForm action={recordStockMovement} hiddenFields={{ storeId, variantId }} className="mt-2 flex min-w-52 flex-col gap-2">
        <Field label="نوع الحركة" htmlFor={`kind-${variantId}`}>
          <Select id={`kind-${variantId}`} name="kind" defaultValue="restock" className="h-9 text-[13px]">
            {Object.entries(MOVEMENT_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="العدد" htmlFor={`qty-${variantId}`}>
          <Input id={`qty-${variantId}`} name="quantity" type="number" inputMode="numeric" min={0} max={100000} required className="h-9 text-[13px]" />
        </Field>
        <Field label="ملاحظة (اختياري)" htmlFor={`note-${variantId}`}>
          <Input id={`note-${variantId}`} name="note" maxLength={200} className="h-9 text-[13px]" />
        </Field>
        <SubmitButton variant="primary" size="sm">
          حفظ
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
