import { LinkButton } from "@/components/ui/button";

export function Pagination({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (page: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="الصفحات" className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-[13px]">
      {page > 1 ? (
        <LinkButton href={hrefFor(page - 1)} variant="outline" size="sm">
          السابق
        </LinkButton>
      ) : (
        <span />
      )}
      <span className="text-muted tabular">
        صفحة {page} من {pages}
      </span>
      {page < pages ? (
        <LinkButton href={hrefFor(page + 1)} variant="outline" size="sm">
          التالي
        </LinkButton>
      ) : (
        <span />
      )}
    </nav>
  );
}
