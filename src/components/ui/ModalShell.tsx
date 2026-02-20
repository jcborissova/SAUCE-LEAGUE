import React, { useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

type ModalShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
  actions?: React.ReactNode;
};

const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClassName = "sm:max-w-3xl",
  actions,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-shell" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" aria-label="Cerrar modal" onClick={onClose} />
      <div className={`modal-card soft-scrollbar relative ${maxWidthClassName}`.trim()}>
        <div className="pointer-events-none absolute left-1/2 top-2 h-1 w-14 -translate-x-1/2 rounded-full bg-[hsl(var(--border))] sm:hidden" />

        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[hsl(var(--border)/0.92)] pb-3 pt-2 sm:pt-0">
          <div>
            <h2 className="app-title text-lg sm:text-xl">{title}</h2>
            {subtitle ? <p className="app-subtitle mt-1">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--muted-foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            aria-label="Cerrar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">{children}</div>

        {actions ? (
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[hsl(var(--border)/0.92)] pt-4">{actions}</div>
        ) : null}
      </div>
    </div>
  );
};

export default ModalShell;
