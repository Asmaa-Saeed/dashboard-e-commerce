import { requireStoreBySlug } from "@/lib/auth/dal";
import { getNavCounts } from "@/features/stores/nav-counts";
import { AppShell } from "@/components/shell/app-shell";
import { StoreLive } from "@/components/shell/store-live";

const ROLE_LABEL = { owner: "صاحب المتجر", staff: "موظف", admin: "إدارة المنصة" } as const;

export default async function StoreLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  const { slug } = await params;
  const { store, role, user, supabase } = await requireStoreBySlug(slug);
  const counts = await getNavCounts(supabase, store.id);

  return (
      <StoreLive storeId={store.id} ordersHref={`/s/${store.slug}/orders`}>
        <AppShell
          store={{ name: store.name, slug: store.slug, logoUrl: store.logo_url }}
          email={user.email}
          roleLabel={ROLE_LABEL[role]}
          canManage={role !== "staff"}
          isAdmin={role === "admin"}
          counts={counts}
        >
          {store.status === "paused" || store.status === "cancelled" ? (
            <p role="status" className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
              اشتراك المتجر متوقف، والبوت لا يرد على العملاء حاليًا. تواصل مع فريق الدعم.
            </p>
          ) : null}
          {children}
        </AppShell>
      </StoreLive>
  );
}
