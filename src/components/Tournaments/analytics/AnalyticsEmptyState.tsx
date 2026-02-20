import React from "react";

type AnalyticsEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

const AnalyticsEmptyState: React.FC<AnalyticsEmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <section className="app-card p-6 text-center space-y-3">
      <div className="space-y-1">
        <h4 className="text-base font-semibold">{title}</h4>
        <p className="text-sm text-[hsl(var(--text-subtle))]">{description}</p>
      </div>

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="btn-secondary min-h-[44px]"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
};

export default AnalyticsEmptyState;
