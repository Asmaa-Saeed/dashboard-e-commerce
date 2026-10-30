import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { z } from "zod";
import { requireStoreBySlug } from "@/lib/auth/dal";
import { formatDateTime, formatTimeAgo } from "@/lib/format";
import { whatsappUrl } from "@/lib/contact";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { ExternalButton, LinkButton } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState, PageHeader, SegmentLinks } from "@/components/ui/layout";
import { ArrowRight, ChatsCircle, Check, HandPalm, Info, Receipt, Robot, WarningCircle, WhatsappLogo } from "@/components/ui/icons";
import { Pagination } from "@/components/pagination";
import { CONVERSATIONS_PAGE_SIZE, countConversations, deliveryOf, getConversation, listConversations } from "@/features/conversations/queries";
import { StaffReplyForm } from "@/features/conversations/components/staff-reply-form";
import { staffReplyConfig } from "@/lib/server-env";
import { updateConversation } from "@/features/conversations/actions";
import { CHANNEL_LABEL, handoffLabel } from "@/features/conversations/labels";

export const metadata: Metadata = { title: "المحادثات" };

const searchSchema = z.object({
  filter: z.enum(["needs", "human", "all"]).optional().catch(undefined),
  id: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export default async function ConversationsPage({ params, searchParams }: PageProps<"/s/[slug]/conversations">) {
  const { slug } = await params;
  const query = searchSchema.parse(await searchParams);
  const { supabase, store } = await requireStoreBySlug(slug);
  const filter = query.filter ?? "needs";
  const page = query.page ?? 1;

  const [{ conversations, total }, counts, detail] = await Promise.all([
    listConversations(supabase, store.id, { filter, page }),
    countConversations(supabase, store.id),
    query.id ? getConversation(supabase, store.id, query.id) : Promise.resolve(null),
  ]);

  const base = `/s/${store.slug}/conversations`;
  const href = (next: { filter?: string; id?: string; page?: number }) => {
    const sp = new URLSearchParams();
    sp.set("filter", next.filter ?? filter);
    if (next.id) sp.set("id", next.id);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    return `${base}?${sp}`;
  };
  const conv = detail?.conversation;
  const customerWa = whatsappUrl(conv?.customers?.phone);
  const canReplyHere = !!conv && (conv.channel_type === "messenger" || conv.channel_type === "instagram");
  const windowOpen = !!detail?.replyWindowOpen;

  return (
    <>
      <PageHeader title="المحادثات" description="عندما يحوّل البوت عميلًا إلى موظف، تظهر المحادثة في «تحتاج إلى رد». يمكنك الرد على عملاء ماسنجر وإنستغرام من هنا مباشرة، ويتوقف البوت تلقائيًا عند ردك." />

      <div className="grid min-h-[620px] overflow-hidden rounded-card border border-line bg-surface shadow-card lg:grid-cols-[360px_1fr]">
        {/* list */}
        <div className={cn("flex min-h-0 flex-col border-line lg:border-e", detail && "hidden lg:flex")}>
          <div className="border-b border-line p-3">
            <SegmentLinks
              label="تصفية المحادثات"
              items={[
                { href: href({ filter: "needs" }), label: "تحتاج إلى رد", active: filter === "needs", count: counts.needs },
                { href: href({ filter: "human" }), label: "يرد عليها موظف", active: filter === "human", count: counts.human },
                { href: href({ filter: "all" }), label: "الكل", active: filter === "all", count: counts.all },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <EmptyState icon={<ChatsCircle className="size-6" />} title={filter === "needs" ? "لا توجد محادثات تنتظر الرد" : "لا توجد محادثات"}>
                {filter === "needs" ? "كل شيء على ما يرام، البوت يتولى الردود." : null}
              </EmptyState>
            ) : (
              <ul className="space-y-1 p-2">
                {conversations.map((c) => {
                  const selected = c.id === query.id;
                  const reason = c.status === "needs_human" ? handoffLabel(c.handoff_reason) : null;
                  const name = c.display_name ?? "زائر";
                  return (
                    <li key={c.id}>
                      <Link
                        href={href({ id: c.id, page })}
                        scroll={false}
                        aria-current={selected ? "true" : undefined}
                        className={cn("flex gap-3 rounded-control px-3 py-3 transition", selected ? "bg-primary-soft" : "hover:bg-surface-muted")}
                      >
                        <span className="relative">
                          <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-[15px] font-semibold text-primary-ink">{name.trim().charAt(0)}</span>
                          {c.status === "needs_human" ? (
                            <span className="absolute -end-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border-2 border-surface bg-warning text-white">
                              <HandPalm className="size-2.5" weight="fill" />
                            </span>
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[14px] font-semibold text-ink">{name}</span>
                            <span className="shrink-0 text-[11px] text-subtle tabular">{formatTimeAgo(c.last_message_at, store.timezone)}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] text-muted">{c.last_message_preview ?? "—"}</span>
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            <Badge>{CHANNEL_LABEL[c.channel_type] ?? c.channel_type}</Badge>
                            {reason ? <Badge tone="warning">{reason}</Badge> : null}
                            {c.status === "human" ? <Badge tone="info">يرد عليها موظف</Badge> : null}
                            {c.orders.length ? <Badge tone="success">أرسل طلبًا</Badge> : null}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Pagination page={page} total={total} pageSize={CONVERSATIONS_PAGE_SIZE} hrefFor={(p) => href({ page: p })} />
        </div>

        {/* thread */}
        {detail && conv ? (
          <section aria-label="المحادثة" className="flex min-h-0 flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <Link href={href({ page })} scroll={false} className="grid size-9 shrink-0 place-items-center rounded-chip text-muted hover:bg-surface-muted lg:hidden" aria-label="العودة إلى المحادثات">
                <ArrowRight className="size-5" />
              </Link>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary-ink">{(conv.display_name ?? conv.customers?.name ?? "ز").trim().charAt(0)}</span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-semibold text-ink">{conv.display_name ?? conv.customers?.name ?? "زائر"}</h2>
                <p className="truncate text-[12px] text-muted">
                  {CHANNEL_LABEL[conv.channel_type] ?? conv.channel_type} · بدأت في {formatDateTime(conv.created_at, store.timezone)}
                </p>
              </div>
              <span className="flex items-center gap-2 rounded-control border border-line px-3 py-1.5 text-[12px]">
                {conv.status === "human" ? <HandPalm className="size-4 text-info" /> : <Robot className="size-4 text-success" />}
                <span className="font-semibold">{conv.status === "human" ? "البوت متوقف، ويرد موظف" : "البوت يرد تلقائيًا"}</span>
              </span>
            </header>

            {conv.status === "needs_human" ? (
              <div className="flex items-center gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2.5">
                <HandPalm className="size-5 shrink-0 text-warning" />
                <p className="flex-1 text-[13px] font-semibold text-ink">حوّل البوت العميل إلى موظف: {handoffLabel(conv.handoff_reason)}</p>
              </div>
            ) : null}

            <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-canvas p-4" aria-label="الرسائل">
              {detail.truncated ? <li className="text-center text-[12px] text-subtle">آخر 200 رسالة فقط</li> : null}
              {detail.messages.map((m) => (
                <li key={m.id} className={cn("flex", m.role === "customer" ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] shadow-card",
                      m.role === "customer" ? "rounded-ss-md bg-surface text-ink" : m.role === "staff" ? "rounded-se-md bg-info text-white" : "rounded-se-md bg-primary text-on-primary",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={cn("mt-1 flex items-center gap-1 text-[11px] tabular", m.role === "customer" ? "text-subtle" : "opacity-75")}>
                      {m.role === "customer" ? "العميل" : m.role === "staff" ? "الفريق" : "البوت"} · {formatDateTime(m.created_at, store.timezone)}
                      {m.role === "staff" ? <DeliveryStatus delivery={deliveryOf(m.meta)} /> : null}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="border-t border-line p-3">
              {!canReplyHere ? (
                <ReplyNote>الرد من اللوحة متاح لمحادثات ماسنجر وإنستغرام فقط.</ReplyNote>
              ) : !staffReplyConfig ? (
                <ReplyNote>الرد من اللوحة غير مفعّل بعد. تواصل مع فريق الدعم.</ReplyNote>
              ) : !windowOpen ? (
                <ReplyNote>مرّت أكثر من 24 ساعة على آخر رسالة من العميل، وMeta لا تسمح بالرد بعدها. تواصل معه على واتساب إن أمكن.</ReplyNote>
              ) : (
                <StaffReplyForm storeId={store.id} conversationId={conv.id} />
              )}
            </div>

            <footer className="flex flex-wrap gap-2 border-t border-line p-3 pt-0 sm:pt-3">
              {conv.status !== "human" ? (
                <ActionForm action={updateConversation} hiddenFields={{ storeId: store.id, conversationId: conv.id, action: "take_over" }}>
                  <SubmitButton variant="primary">
                    <HandPalm className="size-4" />
                    سأرد بنفسي
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {conv.status === "human" || conv.status === "needs_human" ? (
                <ActionForm action={updateConversation} hiddenFields={{ storeId: store.id, conversationId: conv.id, action: "back_to_bot" }}>
                  <SubmitButton variant="outline">
                    <Robot className="size-4" />
                    انتهيت، أعدها إلى البوت
                  </SubmitButton>
                </ActionForm>
              ) : null}
              {customerWa ? (
                <ExternalButton href={customerWa}>
                  <WhatsappLogo className="size-4" />
                  واتساب العميل
                </ExternalButton>
              ) : null}
              {conv.orders.map((o) => (
                <LinkButton key={o.id} href={`/s/${store.slug}/orders?id=${o.id}`} variant="outline">
                  <Receipt className="size-4" />
                  <span dir="ltr">{o.ref}</span>
                </LinkButton>
              ))}
            </footer>
          </section>
        ) : (
          <div className="hidden place-items-center bg-canvas p-6 text-center lg:grid">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-card bg-surface text-subtle shadow-card">
                <ChatsCircle className="size-7" />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-muted">اختر محادثة لعرضها</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ReplyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-control bg-surface-muted px-3 py-2.5 text-[13px] text-muted">
      <Info className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

function DeliveryStatus({ delivery }: { delivery: ReturnType<typeof deliveryOf> }) {
  if (delivery === "sent") return <Check className="size-3.5" aria-label="تم الإرسال" />;
  if (delivery === "failed")
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 font-semibold text-danger">
        <WarningCircle className="size-3.5" weight="fill" />
        لم يُرسل
      </span>
    );
  if (delivery === "queued" || delivery === "sending") return <span>· جارٍ الإرسال</span>;
  return null;
}
