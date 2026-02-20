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
    <section className={`app-card overflow-hidden ${className}`.trim()}>
      {(title || description || actions) ? (
        <header className="border-b border-[hsl(var(--border)/0.72)] bg-[hsl(var(--surface-1))] px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              {title ? <h2 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h2> : null}
              {description ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{description}</p> : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </div>
        </header>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
};

export default SectionCard;
