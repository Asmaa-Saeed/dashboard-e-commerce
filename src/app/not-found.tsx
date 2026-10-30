import { LinkButton } from "@/components/ui/button";
import { MagnifyingGlass } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-card bg-surface text-subtle shadow-card">
          <MagnifyingGlass className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">الصفحة غير موجودة</h1>
        <p className="mt-1 text-muted">الرابط غير صحيح، أو ليست لديك صلاحية لفتح هذه الصفحة.</p>
        <LinkButton href="/" variant="primary" className="mt-6">
          العودة إلى الرئيسية
        </LinkButton>
      </div>
    </main>
  );
}
