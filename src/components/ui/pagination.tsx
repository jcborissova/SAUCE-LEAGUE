import React from "react";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const Pagination: React.FC<Props> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, page - 3),
    Math.max(0, page - 3) + 5
  );

  return (
    <nav className="app-panel flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4" aria-label="Paginación">
      <button className="btn-secondary px-3" onClick={() => onPageChange(page - 1)} disabled={!canPrev}>
        Anterior
      </button>

      <div className="flex items-center gap-1">
        {pages[0] !== 1 && (
          <>
            <PageDot page={1} current={page} onClick={onPageChange} />
            {pages[0] > 2 && <span className="px-1 text-xs text-[hsl(var(--muted-foreground))]">...</span>}
          </>
        )}

        {pages.map((p) => (
          <PageDot key={p} page={p} current={page} onClick={onPageChange} />
        ))}

        {pages[pages.length - 1] !== totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && (
              <span className="px-1 text-xs text-[hsl(var(--muted-foreground))]">...</span>
            )}
            <PageDot page={totalPages} current={page} onClick={onPageChange} />
          </>
        )}
      </div>

      <button className="btn-secondary px-3" onClick={() => onPageChange(page + 1)} disabled={!canNext}>
        Siguiente
      </button>
    </nav>
  );
};

const PageDot = ({
  page,
  current,
  onClick,
}: {
  page: number;
  current: number;
  onClick: (p: number) => void;
}) => (
  <button
    onClick={() => onClick(page)}
    className={`h-9 min-w-9 px-2 text-sm font-semibold transition-colors duration-[var(--motion-hover)] ${
      current === page
        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
        : "border bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
    }`}
    aria-current={current === page ? "page" : undefined}
  >
    {page}
  </button>
);

export default Pagination;
