import Link from "next/link";
import { cn } from "@/lib/cn";
import { CHANNELS, type Channel } from "../labels";
import { CHANNEL_UI } from "./channel-ui";

type Props = {
  active: Channel | null;
  needsByChannel: Record<Channel, number>;
  hrefFor: (channel: Channel | null) => string;
  /** phones: hidden while a chat is open (the chat covers the screen; the chip row would only widen the page) */
  hideOnPhone?: boolean;
};

/**
 * Where the conversations come from. A column on wide screens (icons only on medium-wide ones),
 * a row of chips above the list on phones.
 */
export function ChannelRail({ active, needsByChannel, hrefFor, hideOnPhone = false }: Props) {
  const items: Array<{ key: Channel | null; count: number }> = [
    { key: null, count: CHANNELS.reduce((sum, c) => sum + needsByChannel[c], 0) },
    ...CHANNELS.map((c) => ({ key: c, count: needsByChannel[c] })),
  ];

  return (
    <nav aria-label="منصات التواصل" className={cn(hideOnPhone && "max-lg:hidden", "lg:flex lg:flex-col lg:rounded-[18px] lg:border lg:border-line lg:bg-surface lg:shadow-card")}>
      <h2 className="hidden px-5 pt-5 pb-3 text-[15px] font-semibold text-ink xl:block">منصات التواصل</h2>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-2 xl:px-3 xl:pt-0">
        {items.map(({ key, count }) => {
          const ui = CHANNEL_UI[key ?? "all"];
          const ChannelIcon = ui.icon;
          const selected = active === key;
          return (
            <li key={key ?? "all"} className="shrink-0">
              <Link
                href={hrefFor(key)}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                title={ui.label}
                className={cn(
                  "relative flex items-center gap-2.5 transition active:scale-[0.98]",
                  // phones: pill chips
                  "h-10 rounded-full border px-3.5 text-[13px] font-medium",
                  // wide screens: list rows
                  "lg:h-12 lg:justify-center lg:rounded-[12px] lg:border-0 lg:px-0 lg:text-[14px] xl:justify-start xl:px-3",
                  selected
                    ? "border-primary bg-primary-soft font-semibold text-primary-ink lg:bg-primary-soft"
                    : "border-line bg-surface text-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                <ChannelIcon className={cn("size-5 shrink-0 lg:size-[22px]", ui.mark)} weight={selected ? "fill" : "regular"} />
                <span className="lg:sr-only xl:not-sr-only xl:flex-1">{ui.label}</span>
                {count ? (
                  <span
                    className="grid h-5 min-w-5 place-items-center rounded-full bg-warning px-1.5 text-[11px] leading-none font-bold text-white tabular lg:absolute lg:end-1.5 lg:top-1.5 xl:static"
                    aria-label={`${count} بانتظار موظف`}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
