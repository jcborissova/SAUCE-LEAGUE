import React from "react";
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
  maxWidthClassName = "max-w-3xl",
  actions,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-shell" role="dialog" aria-modal="true">
      <div className={`modal-card soft-scrollbar ${maxWidthClassName}`.trim()}>
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-[hsl(var(--border)/0.85)] pb-3">
          <div>
            <h2 className="app-title text-lg sm:text-xl">{title}</h2>
            {subtitle ? <p className="app-subtitle mt-1">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary h-9 w-9 rounded-lg p-0"
            aria-label="Cerrar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">{children}</div>

        {actions ? <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[hsl(var(--border)/0.85)] pt-4">{actions}</div> : null}
      </div>
    </div>
  );
};

export default ModalShell;
