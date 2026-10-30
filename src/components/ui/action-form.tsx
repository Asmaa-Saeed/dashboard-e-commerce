"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import { Button, type ButtonVariant } from "./button";
import { Warning } from "./icons";
import { useToast } from "./toast";

type Action = (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** Shows each new action result as a toast. */
function useResultToast(state: ActionResult | null) {
  const { toast } = useToast();
  const shown = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (!state || shown.current === state) return;
    shown.current = state;
    toast(state.ok ? { tone: "success", title: state.message } : { tone: "error", title: state.error });
  }, [state, toast]);
}

/**
 * A form bound to a Server Action; the result appears as a toast.
 * The action still runs without JavaScript (only the toast needs it).
 */
export function ActionForm({
  action,
  children,
  className,
  hiddenFields = {},
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  hiddenFields?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, null);
  useResultToast(state);
  return (
    <form action={formAction} className={className}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </form>
  );
}

/**
 * A button that asks first ("هل أنت متأكد؟") and only then submits its form.
 * Used for cancelling orders, deleting zones, removing team members.
 */
export function ConfirmActionButton({
  action,
  hiddenFields,
  label,
  title,
  description,
  confirmLabel,
  variant = "danger-ghost",
  size = "md",
  icon,
  className,
  children,
}: {
  action: Action;
  hiddenFields: Record<string, string>;
  label: string;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
  className?: string;
  /** extra fields shown inside the dialog (e.g. a reason) */
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useResultToast(state);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <Button variant={variant} size={size} className={className} loading={pending} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-card bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] open:animate-pop-in"
      >
        <form action={formAction} onSubmit={() => setOpen(false)} className="p-5">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <span className="grid size-11 place-items-center rounded-control bg-danger-soft text-danger">
            <Warning className="size-5" />
          </span>
          <h2 className="mt-3 text-base font-semibold">{title}</h2>
          {description ? <div className="mt-1.5 text-sm leading-relaxed text-muted">{description}</div> : null}
          {children ? <div className="mt-4">{children}</div> : null}
          <div className="mt-5 flex gap-2">
            <Button type="submit" variant="danger" className="flex-1">
              {confirmLabel}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              تراجع
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
