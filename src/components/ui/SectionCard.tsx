import React from "react";

type SectionCardProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

const SectionCard: React.FC<SectionCardProps> = ({ title, description, actions, className = "", children }) => {
  return (
    <section className={`app-card p-4 sm:p-5 ${className}`.trim()}>
      {(title || description || actions) ? (
        <header className="mb-3 flex flex-col gap-2 border-b border-[hsl(var(--border)/0.75)] pb-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between sm:pb-4">
          <div className="space-y-1">
            {title ? <h2 className="text-base font-semibold sm:text-lg">{title}</h2> : null}
            {description ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
};

export default SectionCard;
