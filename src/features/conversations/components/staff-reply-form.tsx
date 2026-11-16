"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "@/components/ui/toast";
import { SubmitButton } from "@/components/ui/submit-button";
import { PaperPlaneRight } from "@/components/ui/icons";
import { sendStaffReply } from "../actions";

/** Reply box under a Messenger / Instagram conversation. Enter sends, Shift+Enter adds a line. */
export function StaffReplyForm({ storeId, conversationId }: { storeId: string; conversationId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(sendStaffReply, null);
  const { toast } = useToast();
  const form = useRef<HTMLFormElement>(null);
  const shown = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (!state || shown.current === state) return;
    shown.current = state;
    if (state.ok) form.current?.reset();
    else toast({ tone: "error", title: state.error });
  }, [state, toast]);

  return (
    <form ref={form} action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="conversationId" value={conversationId} />
      <label htmlFor="staff-reply" className="sr-only">
        رد على العميل
      </label>
      <textarea
        id="staff-reply"
        name="text"
        required
        maxLength={1000}
        rows={1}
        placeholder="اكتب ردك على العميل…"
        className="max-h-40 min-h-11 flex-1 resize-none rounded-[22px] border border-line bg-canvas px-4 py-2.5 text-[15px] leading-relaxed text-ink [field-sizing:content] placeholder:text-subtle focus:border-primary focus:bg-surface focus:ring-[3px] focus:ring-primary/15 focus:outline-none lg:text-[14px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <SubmitButton variant="primary" aria-label="إرسال" className="size-11 shrink-0 rounded-full p-0">
        <PaperPlaneRight className="size-5 -scale-x-100" weight="fill" />
      </SubmitButton>
    </form>
  );
}
