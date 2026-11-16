import { ChatsCircle, Globe, InstagramLogo, MessengerLogo, WhatsappLogo, type Icon } from "@/components/ui/icons";
import type { Channel } from "../labels";

/** Icon and colour for each channel. Brand-ish hues are used only on the small channel mark, never on surfaces. */
export const CHANNEL_UI: Record<Channel | "all", { icon: Icon; label: string; mark: string }> = {
  all: { icon: ChatsCircle, label: "كل المحادثات", mark: "text-primary" },
  whatsapp: { icon: WhatsappLogo, label: "واتساب", mark: "text-[#1a9e55]" },
  messenger: { icon: MessengerLogo, label: "ماسنجر", mark: "text-[#0a7cff]" },
  instagram: { icon: InstagramLogo, label: "إنستغرام", mark: "text-[#d6266f]" },
  web_chat: { icon: Globe, label: "الموقع", mark: "text-info" },
};

export function channelUi(channel: string) {
  return CHANNEL_UI[(channel in CHANNEL_UI ? channel : "all") as Channel | "all"];
}
