"use client";

import { Button } from "@/components/ui/button";
import { Warning } from "@/components/ui/icons";

// Shown when a page fails to load. The real error stays in the server logs; only its digest reaches the browser.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-card bg-danger-soft text-danger">
          <Warning className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">تعذّر فتح الصفحة</h1>
        <p className="mt-1 text-sm text-muted">حاول مرة أخرى. إذا استمرت المشكلة، أرسل هذا الرقم إلى فريق الدعم: {error.digest ?? "—"}</p>
        <Button variant="primary" className="mt-5" onClick={reset}>
          حاول مرة أخرى
        </Button>
      </div>
    </main>
  );
}
