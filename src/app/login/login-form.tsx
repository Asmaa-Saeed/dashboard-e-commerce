"use client";

import { useActionState } from "react";
import { EnvelopeSimple, LockSimple, Warning } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn, type SignInState } from "./actions";

const box =
  "flex h-12 items-center gap-2.5 rounded-control border border-line bg-surface px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<SignInState, FormData>(signIn, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[13px] font-semibold text-ink">
          البريد الإلكتروني
        </label>
        <div className={box}>
          <EnvelopeSimple className="size-[18px] shrink-0 text-subtle" />
          <input id="email" name="email" type="email" autoComplete="email" required dir="ltr" defaultValue={state?.email ?? ""} className="h-full w-full bg-transparent text-right text-[15px] text-ink outline-none" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-semibold text-ink">
          كلمة المرور
        </label>
        <div className={box}>
          <LockSimple className="size-[18px] shrink-0 text-subtle" />
          <input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" className="h-full w-full bg-transparent text-right text-[15px] text-ink outline-none" />
        </div>
      </div>
      <div role="alert" aria-live="assertive">
        {state?.error ? (
          <p className="flex items-center gap-2 rounded-control bg-danger-soft px-3 py-2.5 text-[13px] font-semibold text-danger">
            <Warning className="size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}
      </div>
      <SubmitButton variant="primary" size="lg" className="w-full">
        دخول
      </SubmitButton>
    </form>
  );
}
