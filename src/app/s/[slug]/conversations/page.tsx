import type { Metadata } from "next";
import type { ReactNode } from "react";
import { z } from "zod";
import { requireStoreBySlug } from "@/lib/auth/dal";
import { whatsappUrl } from "@/lib/contact";
import { staffReplyConfig } from "@/lib/server-env";
import { Info } from "@/components/ui/icons";
import { Pagination } from "@/components/pagination";
import { CONVERSATIONS_PAGE_SIZE, countConversations, deliveryOf, getConversation, listConversations } from "@/features/conversations/queries";
import { CHANNELS, type Channel } from "@/features/conversations/labels";
import { StaffReplyForm } from "@/features/conversations/components/staff-reply-form";
import { ChannelRail } from "@/features/conversations/components/channel-rail";
import { CHANNEL_UI } from "@/features/conversations/components/channel-ui";
import { ConversationList } from "@/features/conversations/components/conversation-list";
import { ConversationThread, NoConversationSelected } from "@/features/conversations/components/conversation-thread";

export const metadata: Metadata = { title: "المحادثات" };

const searchSchema = z.object({
  channel: z.enum(CHANNELS).optional().catch(undefined),
  // "needs" also keeps old links (?filter=needs) working
  needs: z.literal("1").optional().catch(undefined),
  filter: z.string().optional().catch(undefined),
  id: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export default async function ConversationsPage({ params, searchParams }: PageProps<"/s/[slug]/conversations">) {
  const { slug } = await params;
  const query = searchSchema.parse(await searchParams);
  const { supabase, store } = await requireStoreBySlug(slug);
  const channel: Channel | null = query.channel ?? null;
  const needs = query.needs === "1" || query.filter === "needs";
  const page = query.page ?? 1;

  const [{ conversations, total }, counts, detail] = await Promise.all([
    listConversations(supabase, store.id, { channel, needs, page }),
    countConversations(supabase, store.id, channel),
    query.id ? getConversation(supabase, store.id, query.id) : Promise.resolve(null),
  ]);

  const base = `/s/${store.slug}/conversations`;
  const href = (next: { channel?: Channel | null; needs?: boolean; id?: string; page?: number }) => {
    const sp = new URLSearchParams();
    const c = next.channel === undefined ? channel : next.channel;
    if (c) sp.set("channel", c);
    if (next.needs ?? needs) sp.set("needs", "1");
    if (next.id) sp.set("id", next.id);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const conv = detail?.conversation;
  const canReplyHere = !!conv && (conv.channel_type === "messenger" || conv.channel_type === "instagram");
  const reply: ReactNode = !conv ? null : !canReplyHere ? (
    <ReplyNote>الرد من اللوحة متاح لمحادثات ماسنجر وإنستغرام فقط.</ReplyNote>
  ) : !staffReplyConfig ? (
    <ReplyNote>الرد من اللوحة غير مفعّل بعد. تواصل مع فريق الدعم.</ReplyNote>
  ) : !detail?.replyWindowOpen ? (
    <ReplyNote>مرّت أكثر من 24 ساعة على آخر رسالة من العميل، وMeta لا تسمح بالرد بعدها. تواصل معه على واتساب إن أمكن.</ReplyNote>
  ) : (
    <StaffReplyForm storeId={store.id} conversationId={conv.id} />
  );

  return (
    <div className="flex flex-col gap-4 lg:grid lg:h-[calc(100dvh-56px-48px)] lg:min-h-[620px] lg:grid-cols-[76px_minmax(300px,380px)_1fr] lg:gap-4 xl:grid-cols-[210px_minmax(320px,390px)_1fr]">
      <ChannelRail active={channel} needsByChannel={counts.needsByChannel} hrefFor={(c) => href({ channel: c, page: 1 })} />

      <div className={detail ? "hidden min-h-0 lg:flex lg:flex-col" : "flex min-h-0 flex-col"}>
        <ConversationList
          title={channel ? `رسائل ${CHANNEL_UI[channel].label}` : "كل الرسائل"}
          conversations={conversations}
          selectedId={query.id ?? null}
          needsOnly={needs}
          needsCount={counts.needs}
          timezone={store.timezone}
          hrefFor={(id) => href({ id, page })}
          toggleHref={href({ needs: !needs, page: 1 })}
          pagination={<Pagination page={page} total={total} pageSize={CONVERSATIONS_PAGE_SIZE} hrefFor={(p) => href({ page: p })} />}
        />
      </div>

      {detail && conv ? (
        <ConversationThread
          storeId={store.id}
          slug={store.slug}
          timezone={store.timezone}
          conversation={conv}
          messages={detail.messages.map((m) => ({ id: m.id, role: m.role, text: m.text, created_at: m.created_at, delivery: deliveryOf(m.meta) }))}
          truncated={detail.truncated}
          backHref={href({ page })}
          customerWhatsapp={whatsappUrl(conv.customers?.phone)}
          reply={reply}
        />
      ) : (
        <NoConversationSelected />
      )}
    </div>
  );
}

function ReplyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-[14px] bg-surface-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-muted">
      <Info className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}
