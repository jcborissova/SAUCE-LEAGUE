import React from "react";
import Badge from "./Badge";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  badge?: string;
};

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, className = "", badge }) => {
  return (
    <header
      className={`relative flex flex-col gap-3 border-b border-[hsl(var(--border)/0.8)] pb-3 sm:flex-row sm:items-end sm:justify-between sm:pb-4 ${className}`.trim()}
    >
      <span className="pointer-events-none absolute -top-0.5 left-0 h-0.5 w-20 bg-[linear-gradient(90deg,hsl(var(--primary)),transparent)]" />
      <div className="space-y-1.5">
        {badge ? <Badge variant="primary" className="uppercase tracking-[0.08em]">{badge}</Badge> : null}
        {title ? <h1 className="app-title text-2xl leading-tight tracking-tight sm:text-3xl">{title}</h1> : null}
        {subtitle ? <p className="app-subtitle max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
};

export default PageHeader;
