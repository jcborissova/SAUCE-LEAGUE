import React from "react";

type StatPillProps = {
  label: string;
  value: React.ReactNode;
  className?: string;
};

const StatPill: React.FC<StatPillProps> = ({ label, value, className = "" }) => {
  return (
    <div className={`rounded-[var(--radius)] border bg-[hsl(var(--surface-1))] px-3 py-2 ${className}`.trim()}>
      <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--text-subtle))]">{label}</p>
      <p className="text-sm font-semibold sm:text-base">{value}</p>
    </div>
  );
};

export default StatPill;
