import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EllipsisVerticalIcon, EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/solid";

type Action = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
};

type Props = {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
};

const ActionMenu: React.FC<Props> = ({ onView, onEdit, onDelete, className }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const actions: Action[] = [
    ...(onView ? [{ label: "Ver", icon: <EyeIcon className="h-4 w-4" />, onClick: onView, tone: "default" as const }] : []),
    ...(onEdit ? [{ label: "Editar", icon: <PencilIcon className="h-4 w-4" />, onClick: onEdit, tone: "default" as const }] : []),
    ...(onDelete
      ? [{ label: "Eliminar", icon: <TrashIcon className="h-4 w-4" />, onClick: onDelete, tone: "danger" as const }]
      : []),
  ];

  const calculateMenuPosition = () => {
    if (!buttonRef.current) return;

    const triggerRect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 184;
    const menuHeight = Math.max(52, actions.length * 44 + 10);
    const viewportPadding = 8;

    const desiredLeft = triggerRect.right - menuWidth;
    const left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, desiredLeft)
    );

    const top = Math.min(
      window.innerHeight - menuHeight - viewportPadding,
      Math.max(viewportPadding, triggerRect.bottom + viewportPadding)
    );

    setMenuPosition({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    calculateMenuPosition();
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const handleReposition = () => calculateMenuPosition();
    const handleScrollClose = () => setOpen(false);

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleScrollClose, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleScrollClose, true);
    };
  }, [open]);

  return (
    <div className={`relative inline-flex ${className || ""}`} ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>

      {open &&
        actions.length > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[1200] min-w-[184px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 text-[hsl(var(--card-foreground))] shadow-sm"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  action.onClick();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))] ${
                  action.tone === "danger" ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--foreground))]"
                }`}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

export default ActionMenu;
