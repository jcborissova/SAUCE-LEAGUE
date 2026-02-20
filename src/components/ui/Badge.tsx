import React from "react";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

type BadgeProps = {
  children: React.ReactNode;
  className?: string;
  variant?: BadgeVariant;
};

const badgeClassByVariant: Record<BadgeVariant, string> = {
  default: "border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] text-[hsl(var(--text-subtle))]",
  primary: "border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]",
  success: "border-[hsl(var(--success)/0.34)] bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]",
  warning: "border-[hsl(var(--warning)/0.34)] bg-[hsl(var(--warning)/0.16)] text-[hsl(var(--warning))]",
  danger: "border-[hsl(var(--destructive)/0.34)] bg-[hsl(var(--destructive)/0.14)] text-[hsl(var(--destructive))]",
};

const Badge: React.FC<BadgeProps> = ({ children, className = "", variant = "default" }) => {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius)] border px-2.5 py-1 text-xs font-semibold ${badgeClassByVariant[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
};

export default Badge;
