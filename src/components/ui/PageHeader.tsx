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
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div className="space-y-1.5">
        {badge ? <Badge variant="primary">{badge}</Badge> : null}
        {title ? <h1 className="app-title text-2xl leading-tight sm:text-3xl">{title}</h1> : null}
        {subtitle ? <p className="app-subtitle max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
};

export default PageHeader;
