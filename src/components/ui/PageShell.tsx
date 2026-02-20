import React from "react";

import PageHeader from "./PageHeader";

type PageShellProps = {
  title?: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

const PageShell: React.FC<PageShellProps> = ({
  title,
  subtitle,
  badge,
  actions,
  className = "",
  contentClassName = "",
  children,
}) => {
  return (
    <section className={`mx-auto w-full max-w-[1180px] px-0 py-1 sm:py-2 ${className}`.trim()}>
      {(title || subtitle || badge || actions) ? (
        <PageHeader title={title || ""} subtitle={subtitle} badge={badge} actions={actions} className="mb-4 sm:mb-5" />
      ) : null}
      <div className={`space-y-4 sm:space-y-5 bottom-nav-safe lg:pb-0 ${contentClassName}`.trim()}>{children}</div>
    </section>
  );
};

export default PageShell;
