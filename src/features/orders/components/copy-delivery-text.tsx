"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { CheckCircle, Copy, Truck } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { buildDeliveryText, type DeliveryTextInput } from "../delivery-text";

type Company = { id: string; name: string; copy_template: string | null };

export function CopyDeliveryText({ order, companies, defaultCompanyId }: { order: DeliveryTextInput; companies: Company[]; defaultCompanyId: string | null }) {
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? companies[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const selectId = useId();
  const { toast } = useToast();

  const template = companies.find((c) => c.id === companyId)?.copy_template ?? null;
  const text = useMemo(() => buildDeliveryText(order, template), [order, template]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ tone: "success", title: "تم نسخ النص", description: "الصقه لدى شركة التوصيل." });
    } catch {
      // clipboard blocked: select the text so it can be copied by hand
      textRef.current?.select();
      toast({ tone: "info", title: "تم تحديد النص", description: "اضغط Ctrl+C لنسخه." });
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold">
          <span className="grid size-8 place-items-center rounded-chip bg-primary-soft text-primary-ink">
            <Truck className="size-4" />
          </span>
          نص لشركة التوصيل
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {companies.length > 1 ? (
            <>
              <label htmlFor={selectId} className="sr-only">
                شركة التوصيل
              </label>
              <Select
                id={selectId}
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setCopied(false);
                }}
                className="h-9 w-auto text-[13px]"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </>
          ) : null}
          <Button variant="primary" size="sm" onClick={copy}>
            {copied ? <CheckCircle className="size-4" /> : <Copy className="size-4" />}
            {copied ? "تم النسخ" : "نسخ للتوصيل"}
          </Button>
        </div>
      </div>
      <textarea
        ref={textRef}
        readOnly
        value={text}
        rows={Math.min(12, text.split("\n").length + 1)}
        aria-label="نص الطلب لشركة التوصيل"
        className="mt-3 w-full resize-none rounded-control border border-line bg-canvas p-3 text-[13px] leading-relaxed text-ink"
      />
    </div>
  );
}
