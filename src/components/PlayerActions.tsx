// components/PlayerActions.tsx
import { PencilIcon, EyeIcon, TrashIcon } from "@heroicons/react/24/solid";

interface Props {
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}

const PlayerActions: React.FC<Props> = ({ onEdit, onView, onDelete }) => {
  return (
    <div className="flex flex-col bg-white rounded shadow-md absolute top-full right-0 mt-1 w-40 z-50">
      <button
        onClick={onView}
        className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 text-blue-950"
      >
        <EyeIcon className="h-4 w-4 mr-2" />
        Ver jugador
      </button>
      <button
        onClick={onEdit}
        className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 text-blue-950"
      >
        <PencilIcon className="h-4 w-4 mr-2" />
        Editar
      </button>
      <button
        onClick={onDelete}
        className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 text-red-600"
      >
        <TrashIcon className="h-4 w-4 mr-2" />
        Eliminar
      </button>
    </div>
  );
};

export default PlayerActions;
