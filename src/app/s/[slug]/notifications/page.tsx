import type { Metadata } from "next";
import { requireStoreBySlug } from "@/lib/auth/dal";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Bell, Checks } from "@/components/ui/icons";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { groupByDay } from "@/features/notifications/labels";
import { markNotificationsRead } from "@/features/notifications/actions";
import { countUnread, listNotifications } from "@/features/notifications/queries";
import { NotificationRow } from "@/features/notifications/components/notification-list";

export const metadata: Metadata = { title: "الإشعارات" };

export default async function NotificationsPage({ params }: PageProps<"/s/[slug]/notifications">) {
  const { slug } = await params;
  const { supabase, store, user } = await requireStoreBySlug(slug);
  const [items, unread] = await Promise.all([listNotifications(supabase, store.id, user.id, 100), countUnread(supabase, store.id, user.id)]);
  const groups = groupByDay(items, store.timezone);

  return (
    <>
      <PageHeader
        title="الإشعارات"
        description={unread ? `لديك ${unread} إشعارات غير مقروءة.` : "كل شيء مقروء."}
        actions={
          unread ? (
            <ActionForm action={markNotificationsRead} hiddenFields={{ storeId: store.id }}>
              <SubmitButton variant="outline">
                <Checks className="size-4" />
                تعليم الكل كمقروء
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      />

      {items.length === 0 ? (
        <div className="rounded-[18px] border border-line bg-surface shadow-card">
          <EmptyState icon={<Bell className="size-6" />} title="لا توجد إشعارات بعد">
            ستظهر هنا الطلبات الجديدة، والمحادثات التي تحتاج إلى رد، وطلبات التعديل، والمنتجات التي نفدت، ورسائل Flowpal.
          </EmptyState>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="px-1 pb-2 text-[13px] font-semibold text-muted">{group.label}</h2>
              <ul className="space-y-0.5 rounded-[18px] border border-line bg-surface p-1.5 shadow-card">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <NotificationRow item={item} storeId={store.id} timezone={store.timezone} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
