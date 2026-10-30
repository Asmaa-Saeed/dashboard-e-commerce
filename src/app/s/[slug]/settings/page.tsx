import type { Metadata } from "next";
import { z } from "zod";
import { canManageStore, requireStoreBySlug } from "@/lib/auth/dal";
import { PageHeader, SegmentLinks } from "@/components/ui/layout";
import { getSettings } from "@/features/settings/queries";
import { BotForm, CompaniesEditor, PoliciesForm, StoreProfileForm, TeamPanel, ZonesEditor } from "@/features/settings/components/settings-forms";

export const metadata: Metadata = { title: "الإعدادات" };

const TABS = {
  store: "المتجر",
  policies: "السياسات",
  delivery: "التوصيل",
  bot: "البوت والقنوات",
  team: "الفريق",
} as const;
type Tab = keyof typeof TABS;

const searchSchema = z.object({ tab: z.enum(Object.keys(TABS) as [Tab, ...Tab[]]).optional().catch(undefined) });

export default async function SettingsPage({ params, searchParams }: PageProps<"/s/[slug]/settings">) {
  const { slug } = await params;
  const tab: Tab = searchSchema.parse(await searchParams).tab ?? "store";
  const { supabase, store, role, user } = await requireStoreBySlug(slug);
  const canEdit = canManageStore(role);
  const settings = await getSettings(supabase, store.id);
  const common = { store, canEdit };

  return (
    <>
      <PageHeader
        title={canEdit ? "الإعدادات" : "معلومات المتجر"}
        description={canEdit ? "يطبّق البوت أي تعديل هنا فورًا." : "يعدّل صاحب المتجر هذه الإعدادات، ويمكنك الاطلاع عليها فقط."}
      />
      <SegmentLinks label="أقسام الإعدادات" items={(Object.keys(TABS) as Tab[]).map((t) => ({ href: `/s/${store.slug}/settings?tab=${t}`, label: TABS[t], active: t === tab }))} />

      {tab === "store" ? <StoreProfileForm {...common} /> : null}
      {tab === "policies" ? <PoliciesForm {...common} policies={settings.policies} /> : null}
      {tab === "delivery" ? (
        <>
          <ZonesEditor {...common} zones={settings.zones} />
          <CompaniesEditor {...common} companies={settings.companies} />
        </>
      ) : null}
      {tab === "bot" ? <BotForm {...common} bot={settings.bot} channels={settings.channels} /> : null}
      {tab === "team" ? <TeamPanel {...common} team={settings.team} currentUserId={user.id} /> : null}
    </>
  );
}
