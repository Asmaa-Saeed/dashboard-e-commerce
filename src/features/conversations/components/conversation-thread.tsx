import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatTimeAgo } from "@/lib/format";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { ExternalButton, LinkButton } from "@/components/ui/button";
import { ArrowRight, ArrowUUpLeft, Check, CheckCircle, HandPalm, Receipt, Robot, WarningCircle, WhatsappLogo } from "@/components/ui/icons";
import { updateConversation } from "../actions";
import { conversationHandle, conversationTitle, handoffLabel } from "../labels";
import { Avatar } from "./conversation-list";
import { channelUi } from "./channel-ui";
import { RobotIllustration } from "./robot-illustration";

export type ThreadConversation = {
  id: string;
  display_name: string | null;
  username: string | null;
  channel_type: string;
  status: string;
  handoff_reason: string | null;
  created_at: string;
  customers: { name: string | null; phone: string | null } | null;
  orders: Array<{ id: string; ref: string }>;
};

export type ThreadMessage = { id: number; role: string; text: string | null; created_at: string; delivery: "queued" | "sending" | "sent" | "failed" | null };

type Props = {
  storeId: string;
  slug: string;
  timezone: string;
  conversation: ThreadConversation;
  messages: ThreadMessage[];
  truncated: boolean;
  backHref: string;
  customerWhatsapp: string | null;
  /** the reply box, or a note explaining why replying here isn't possible */
  reply: ReactNode;
  now?: number;
};

const ROLE_LABEL: Record<string, string> = { bot: "موظف الذكاء الاصطناعي", staff: "الفريق", customer: "العميل" };

export function ConversationThread({ storeId, slug, timezone, conversation: conv, messages, truncated, backHref, customerWhatsapp, reply, now }: Props) {
  const name = conversationTitle({ display_name: conv.display_name, customer_name: conv.customers?.name });
  const channel = channelUi(conv.channel_type);
  const ChannelIcon = channel.icon;
  const closed = conv.status === "closed";
  const action = (value: "take_over" | "back_to_bot" | "close") => ({ storeId, conversationId: conv.id, action: value });

  return (
    <section
      aria-label={`محادثة ${name}`}
      className={cn(
        "flex min-h-0 flex-col bg-surface",
        // phones: the chat takes the whole screen, like a messaging app
        "max-lg:fixed max-lg:inset-0 max-lg:z-[45] max-lg:pt-[env(safe-area-inset-top)]",
        "lg:rounded-[18px] lg:border lg:border-line lg:shadow-card",
      )}
    >
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 lg:px-5 lg:py-4">
        <Link href={backHref} scroll={false} className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-surface-muted lg:hidden" aria-label="العودة إلى المحادثات">
          <ArrowRight className="size-5" />
        </Link>
        <span className="relative">
          <Avatar name={name} size="lg" />
          <span className="absolute -end-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full border-2 border-surface bg-surface shadow-card">
            <ChannelIcon className={cn("size-3.5", channel.mark)} weight="fill" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-semibold text-ink lg:text-[17px]">{name}</h2>
          <p className="truncate text-[13px] text-muted">
            <span dir="ltr">{conversationHandle({ username: conv.username, channel_type: conv.channel_type })}</span>
            <span className="hidden sm:inline"> · بدأت {formatDateTime(conv.created_at, timezone)}</span>
          </p>
        </div>
        <BotPill status={conv.status} />
      </header>

      {conv.status === "needs_human" ? (
        <div className="flex items-center gap-2.5 border-b border-warning/25 bg-warning-soft px-4 py-2.5 lg:px-5">
          <HandPalm className="size-5 shrink-0 text-warning" weight="fill" />
          <p className="flex-1 text-[13px] font-semibold text-ink">العميل يحتاج تدخلًا بشريًا: {handoffLabel(conv.handoff_reason)}</p>
        </div>
      ) : null}

      <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-canvas px-3 py-4 lg:mx-4 lg:my-4 lg:rounded-[14px] lg:px-5" aria-label="الرسائل">
        {truncated ? <li className="text-center text-[12px] text-subtle">آخر 200 رسالة فقط</li> : null}
        {messages.length === 0 ? <li className="py-10 text-center text-[13px] text-subtle">لا توجد رسائل في هذه المحادثة بعد.</li> : null}
        {messages.map((m) => (
          <Bubble key={m.id} message={m} timezone={timezone} now={now} />
        ))}
      </ol>

      {closed ? (
        <ResolvedState storeId={storeId} conversationId={conv.id} />
      ) : (
        <div className="border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:rounded-b-[18px]">
          <div className="px-3 pt-3 lg:px-5">{reply}</div>
          <div className="flex gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none] lg:flex-wrap lg:px-5">
            {conv.status !== "human" ? (
              <ActionForm action={updateConversation} hiddenFields={action("take_over")}>
                <SubmitButton variant={conv.status === "needs_human" ? "primary" : "outline"} className="rounded-full whitespace-nowrap">
                  <HandPalm className="size-4" />
                  سأرد بنفسي
                </SubmitButton>
              </ActionForm>
            ) : null}
            {conv.status === "human" || conv.status === "needs_human" ? (
              <>
                <ActionForm action={updateConversation} hiddenFields={action("close")}>
                  <SubmitButton variant={conv.status === "human" ? "primary" : "outline"} className="rounded-full whitespace-nowrap">
                    <CheckCircle className="size-4" />
                    تم الحل
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={updateConversation} hiddenFields={action("back_to_bot")}>
                  <SubmitButton variant="outline" className="rounded-full whitespace-nowrap">
                    <Robot className="size-4" />
                    أعدها إلى البوت
                  </SubmitButton>
                </ActionForm>
              </>
            ) : null}
            {customerWhatsapp ? (
              <ExternalButton href={customerWhatsapp} className="rounded-full whitespace-nowrap">
                <WhatsappLogo className="size-4" />
                واتساب العميل
              </ExternalButton>
            ) : null}
            {conv.orders.map((o) => (
              <LinkButton key={o.id} href={`/s/${slug}/orders?id=${o.id}`} variant="outline" className="rounded-full whitespace-nowrap">
                <Receipt className="size-4" />
                <span dir="ltr">{o.ref}</span>
              </LinkButton>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BotPill({ status }: { status: string }) {
  const ui =
    status === "human"
      ? { text: "البوت متوقف، يرد موظف", cls: "border-info/25 bg-info-soft text-info", icon: <HandPalm className="size-4" /> }
      : status === "needs_human"
        ? { text: "بانتظار موظف", cls: "border-warning/30 bg-warning-soft text-warning", icon: <HandPalm className="size-4" weight="fill" /> }
        : status === "closed"
          ? { text: "تم الحل", cls: "border-line bg-surface-muted text-neutral", icon: <Check className="size-4" weight="bold" /> }
          : { text: "رد البوت التلقائي مفعّل", cls: "border-success/25 bg-success-soft text-success", icon: <Robot className="size-4" /> };
  return (
    <span className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold", ui.cls)} title={ui.text}>
      {ui.icon}
      <span className="hidden sm:inline">{ui.text}</span>
    </span>
  );
}

/** Customer on the far side; the bot and the team on the near side, with who sent it above the bubble. */
function Bubble({ message: m, timezone, now }: { message: ThreadMessage; timezone: string; now?: number }) {
  const fromCustomer = m.role === "customer";
  return (
    <li className={cn("flex items-end gap-2", fromCustomer ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          fromCustomer ? "border border-[#c7d2e0] bg-[#eef2f7] text-[#3d4f66]" : m.role === "staff" ? "bg-info-soft text-info" : "bg-primary-soft text-primary",
        )}
        aria-hidden="true"
      >
        {fromCustomer ? <span className="text-[12px] font-semibold">ع</span> : m.role === "staff" ? <HandPalm className="size-4" /> : <Robot className="size-4" />}
      </span>
      <div className={cn("flex max-w-[82%] flex-col gap-1 lg:max-w-[70%]", fromCustomer ? "items-end" : "items-start")}>
        {!fromCustomer ? (
          <p className="px-1 text-[12px] text-muted">
            <span className="font-semibold text-ink">{ROLE_LABEL[m.role] ?? m.role}</span>
            <span className="mx-1.5 text-line">|</span>
            <span className="tabular">{formatTimeAgo(m.created_at, timezone, now)}</span>
          </p>
        ) : null}
        <div
          className={cn(
            "rounded-[18px] px-4 py-2.5 text-[14px] leading-relaxed shadow-card",
            fromCustomer ? "rounded-ee-[6px] bg-surface text-ink" : m.role === "staff" ? "rounded-es-[6px] bg-info text-white" : "rounded-es-[6px] bg-primary text-on-primary",
          )}
        >
          <p className="break-words whitespace-pre-wrap">{m.text}</p>
          {m.role === "staff" && m.delivery ? <Delivery delivery={m.delivery} /> : null}
        </div>
        {fromCustomer ? <p className="px-1 text-[11px] text-subtle tabular">{formatTimeAgo(m.created_at, timezone, now)}</p> : null}
      </div>
    </li>
  );
}

function Delivery({ delivery }: { delivery: NonNullable<ThreadMessage["delivery"]> }) {
  if (delivery === "sent")
    return (
      <span className="mt-1 flex items-center gap-1 text-[11px] opacity-80">
        <Check className="size-3.5" /> تم الإرسال
      </span>
    );
  if (delivery === "failed")
    return (
      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-danger">
        <WarningCircle className="size-3.5" weight="fill" /> لم يُرسل
      </span>
    );
  return <span className="mt-1 block text-[11px] opacity-80">جارٍ الإرسال…</span>;
}

/** After «تم الحل»: a calm confirmation in place of the reply box, with a way back. */
function ResolvedState({ storeId, conversationId }: { storeId: string; conversationId: string }) {
  return (
    <div className="flex flex-col items-center border-t border-line px-6 pt-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center lg:rounded-b-[18px]">
      <span className="grid size-[72px] place-items-center rounded-[20px] bg-success-soft text-success motion-safe:animate-pop-in">
        <CheckCircle className="size-10" weight="bold" />
      </span>
      <h3 className="mt-4 text-[19px] font-semibold text-ink">تم حل هذه المحادثة بنجاح</h3>
      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">أُغلقت المحادثة، ويمكنك مراجعة سجل الرسائل في الأعلى. إذا راسل العميل من جديد، يرد عليه البوت تلقائيًا.</p>
      <ActionForm action={updateConversation} hiddenFields={{ storeId, conversationId, action: "back_to_bot" }} className="mt-4">
        <SubmitButton variant="ghost" size="sm" className="rounded-full">
          <ArrowUUpLeft className="size-4" />
          إعادة فتحها وإرجاعها إلى البوت
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

/** Wide screens with nothing selected yet. */
export function NoConversationSelected() {
  return (
    <div className="hidden min-h-0 flex-col rounded-[18px] border border-line bg-surface p-4 shadow-card lg:flex">
      <div className="grid flex-1 place-items-center rounded-[14px] bg-canvas px-6 text-center">
        <div className="flex flex-col items-center">
          <RobotIllustration />
          <p className="mt-6 text-[19px] font-semibold text-ink">حدد محادثة لعرضها</p>
          <p className="mt-1.5 max-w-xs text-[14px] text-muted">البوت يرد على عملائك طوال الوقت. اختر محادثة من القائمة لقراءتها أو للرد بنفسك.</p>
        </div>
      </div>
    </div>
  );
}
