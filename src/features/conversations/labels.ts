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
