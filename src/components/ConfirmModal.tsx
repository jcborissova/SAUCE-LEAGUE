import React from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onCancel, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full animate-fade-in">
        <h3 className="text-lg font-bold text-blue-950 mb-2">{title}</h3>
        <p className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-sm"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
            onClick={onConfirm}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
