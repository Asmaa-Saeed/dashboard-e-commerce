import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { safeNextPath } from "@/lib/safe-redirect";
import { ChatsCircle, Package, Receipt, Storefront } from "@/components/ui/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول" };

const FEATURES = [
  { icon: Receipt, text: "طلبات البوت تصلك لحظة بلحظة" },
  { icon: ChatsCircle, text: "المحادثات التي تحتاج إلى رد في مكان واحد" },
  { icon: Package, text: "المنتجات والمخزون والتوصيل" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-2">
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[360px] animate-slide-in">
          <span className="grid size-10 place-items-center rounded-control bg-primary text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]">
            <Storefront className="size-[22px]" weight="fill" />
          </span>
          <h1 className="mt-8 text-[24px] font-semibold tracking-tight text-ink">مرحبًا بعودتك</h1>
          <p className="mt-1.5 text-[14px] text-muted">سجّل الدخول بحساب المتجر الذي وصلك منا.</p>
          <div className="mt-8">
            <LoginForm next={nextPath} />
          </div>
        </div>
      </main>

      <aside className="relative m-3 hidden overflow-hidden rounded-[20px] bg-[#0b3b37] lg:block" aria-hidden="true">
        {/* soft grid and glow behind the content */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute -top-40 start-1/4 size-[520px] rounded-full bg-primary/40 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <p className="text-[14px] font-medium text-white/70">لوحة إدارة المتجر</p>

          <div>
            <h2 className="max-w-md text-[34px] leading-snug font-semibold tracking-tight">كل ما يحدث في متجرك، في شاشة واحدة.</h2>
            <ul className="mt-8 space-y-3.5">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[15px] text-white/85">
                  <span className="grid size-9 place-items-center rounded-control border border-white/15 bg-white/10">
                    <Icon className="size-[18px]" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
