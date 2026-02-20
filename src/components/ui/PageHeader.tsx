import React from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  badge?: string;
};

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = "",
  badge,
}) => {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div className="space-y-1.5">
        {badge ? (
          <span className="inline-flex rounded-md border border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.08)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--primary))]">
            {badge}
          </span>
        ) : null}
        <h1 className="app-title text-2xl sm:text-3xl">{title}</h1>
        {subtitle ? <p className="app-subtitle max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
};

export default PageHeader;
