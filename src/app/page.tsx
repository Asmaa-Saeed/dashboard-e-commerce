import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isPlatformAdmin, requireUser } from "@/lib/auth/dal";
import { getMyStores } from "@/features/stores/queries";
import { Storefront } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/layout";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "لوحة المتجر" };

// Each client account belongs to one store and goes straight to it. Stores are created
// (and added to an account) only by the platform admin, who lands on the admin page.
export default async function Home() {
  await requireUser();
  if (await isPlatformAdmin()) redirect("/admin");
  const [store] = await getMyStores();
  if (store) redirect(`/s/${store.slug}/orders`);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState icon={<Storefront className="size-6" />} title="لا يوجد متجر مرتبط بحسابك" action={<SignOutButton />}>
        تواصل مع فريق الدعم لربط حسابك بمتجرك.
      </EmptyState>
    </main>
  );
}
