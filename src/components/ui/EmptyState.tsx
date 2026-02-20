import React from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = "",
}) => {
  return (
    <section className={`app-card p-6 text-center sm:p-8 ${className}`.trim()}>
      {icon ? <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-[hsl(var(--muted-foreground))]">{icon}</div> : null}
      <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
};

export default EmptyState;
