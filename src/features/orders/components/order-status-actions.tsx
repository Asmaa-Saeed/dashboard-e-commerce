"use client";

import Link from "next/link";
import { ActionForm, ConfirmActionButton } from "@/components/ui/action-form";
import { buttonClass } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ArrowCounterClockwise, ArrowLeft, X } from "@/components/ui/icons";
import { changeOrderStatus } from "../actions";
import { NEXT_STEP, PREVIOUS_STEP, STATUS_LABEL, canMove, type OrderStatus } from "../status";

/**
 * The buttons that move an order along. `compact` is the board card (main step + cancel + details);
 * the full version in the order panel also offers one step back.
 */
export function OrderStatusActions({
  storeId,
  orderId,
  orderRef,
  customerName,
  status,
  detailsHref,
  compact = false,
}: {
  storeId: string;
  orderId: string;
  orderRef: string;
  customerName: string;
  status: OrderStatus;
  detailsHref?: string;
  compact?: boolean;
}) {
  const next = NEXT_STEP[status];
  const previous = PREVIOUS_STEP[status];
  const hidden = { storeId, orderId };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {next ? (
          <ActionForm action={changeOrderStatus} hiddenFields={{ ...hidden, to: next.to }} className="flex-1">
            <SubmitButton variant="primary" className="w-full">
              {next.label}
              <ArrowLeft className="size-4" />
            </SubmitButton>
          </ActionForm>
        ) : null}
        {canMove(status, "cancelled") ? (
          <ConfirmActionButton
            action={changeOrderStatus}
            hiddenFields={{ ...hidden, to: "cancelled" }}
            variant="secondary"
            className="px-3 text-danger hover:bg-danger-soft"
            icon={<X className="size-4" />}
            label="إلغاء"
            title={`إلغاء الطلب ${orderRef}؟`}
            description={
              <>
                سيُلغى طلب <b className="text-ink">{customerName}</b>. إذا كان مؤكدًا، تعود الكمية إلى المخزون.
              </>
            }
            confirmLabel="نعم، ألغِ الطلب"
          >
            <Field label="سبب الإلغاء (اختياري)" htmlFor={`cancel-${orderId}`}>
              <Textarea id={`cancel-${orderId}`} name="cancelReason" maxLength={300} rows={2} />
            </Field>
          </ConfirmActionButton>
        ) : null}
      </div>
      <div className="flex gap-2">
        {compact && detailsHref ? (
          <Link href={detailsHref} scroll={false} className={buttonClass("outline", "sm", "flex-1")}>
            التفاصيل ونسخ للتوصيل
          </Link>
        ) : null}
        {!compact && previous ? (
          <ActionForm action={changeOrderStatus} hiddenFields={{ ...hidden, to: previous }}>
            <SubmitButton variant="ghost" size="sm">
              <ArrowCounterClockwise className="size-4" />
              إعادة إلى «{STATUS_LABEL[previous]}»
            </SubmitButton>
          </ActionForm>
        ) : null}
      </div>
    </div>
  );
}
