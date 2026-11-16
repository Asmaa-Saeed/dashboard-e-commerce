export const CONVERSATION_STATUSES = ["bot", "needs_human", "human", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  bot: "يرد البوت",
  needs_human: "تحتاج إلى رد",
  human: "يرد موظف",
  closed: "مغلقة",
};

export const CHANNEL_LABEL: Record<string, string> = {
  web_chat: "دردشة الموقع",
  messenger: "ماسنجر",
  instagram: "إنستغرام",
  whatsapp: "واتساب",
};

/** Channels in the order the inbox lists them. */
export const CHANNELS = ["whatsapp", "messenger", "instagram", "web_chat"] as const;
export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

/** The name shown for a conversation: the chat's display name, else the customer's, else «زائر». */
export function conversationTitle({ display_name, customer_name }: { display_name: string | null; customer_name?: string | null }) {
  return display_name?.trim() || customer_name?.trim() || "زائر";
}

/** The line under the name: @username on Instagram / Messenger when known, else the channel's name. */
export function conversationHandle({ username, channel_type }: { username: string | null; channel_type: string }) {
  const handle = username?.trim().replace(/^@/, "");
  if (handle) return `@${handle}`;
  return CHANNEL_LABEL[channel_type] ?? channel_type;
}

export const HANDOFF_REASON_LABEL: Record<string, string> = {
  wholesale: "طلب جملة",
  asked_for_human: "طلب التحدث مع موظف",
  order_change: "تعديل أو إلغاء طلب",
  order_failed: "تعذّر حفظ الطلب",
  unknown_info: "سؤال لا يعرف البوت إجابته",
};

export function handoffLabel(reason: string | null) {
  if (!reason) return null;
  return HANDOFF_REASON_LABEL[reason] ?? "يحتاج إلى موظف";
}
