import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { getMyStores } from "@/features/stores/queries";
import { LinkButton } from "@/components/ui/button";
import { ArrowLeft, CrownSimple, Storefront } from "@/components/ui/icons";
import { Card, EmptyState } from "@/components/ui/layout";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "كل المتاجر" };

const ROLE_LABEL: Record<string, string> = { owner: "صاحب المتجر", staff: "موظف", admin: "إدارة المنصة" };

export default async function StoresPage() {
  // Only the platform admin works across stores; a client account belongs to one store.
  const { user } = await requireAdmin();
  const stores = await getMyStores();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">كل المتاجر</h1>
          <p className="truncate text-right text-sm text-muted" dir="ltr">
            {user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/admin" variant="primary">
            <CrownSimple className="size-4" />
            إدارة المنصة
          </LinkButton>
          <SignOutButton />
        </div>
      </div>

      <Card className="overflow-hidden">
        {stores.length === 0 ? (
          <EmptyState icon={<Storefront className="size-6" />} title="لا توجد متاجر بعد">
            أنشئ متجرًا من صفحة إدارة المنصة.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {stores.map((store) => (
              <li key={store.id}>
                <Link href={`/s/${store.slug}/orders`} className="flex min-h-[72px] items-center gap-3 px-5 py-3 transition hover:bg-surface-muted">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-soft text-lg font-semibold text-primary-ink"
                    aria-hidden="true"
                  >
                    {store.name.trim().charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{store.name}</span>
                    <span className="text-[13px] text-muted">{ROLE_LABEL[store.role] ?? store.role}</span>
                  </span>
                  <ArrowLeft className="size-5 text-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
