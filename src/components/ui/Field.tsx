import React from "react";

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
};

const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, children, className = "" }) => {
  return (
    <label htmlFor={htmlFor} className={`block space-y-1.5 ${className}`.trim()}>
      <span className="text-sm font-medium text-[hsl(var(--text-strong))]">{label}</span>
      {children}
      {hint ? <p className="text-xs text-[hsl(var(--text-subtle))]">{hint}</p> : null}
    </label>
  );
};

export default Field;
