import React from "react";
import ModalShell from "./ui/ModalShell";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onCancel, onConfirm }) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      maxWidthClassName="max-w-sm"
      actions={
        <>
          <button className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={onConfirm}>
            Eliminar
          </button>
        </>
      }
    >
      <p className="text-sm text-[hsl(var(--text-subtle))]">{message}</p>
    </ModalShell>
  );
};

export default ConfirmModal;
