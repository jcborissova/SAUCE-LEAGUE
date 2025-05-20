// src/components/ToggleView.tsx
import React from "react";
import { TableCellsIcon, Squares2X2Icon } from "@heroicons/react/24/solid";

interface ToggleViewProps {
  viewMode: "table" | "cards";
  setViewMode: (mode: "table" | "cards") => void;
}

const ToggleView: React.FC<ToggleViewProps> = ({ viewMode, setViewMode }) => {
  return (
    <div className="flex space-x-2">
      <button 
        onClick={() => setViewMode("table")} 
        className={`p-2 rounded-full ${viewMode === "table" ? "bg-red-900 text-white" : "bg-gray-200 text-gray-700"}`}>
        <TableCellsIcon className="h-6 w-6" />
      </button>
      <button 
        onClick={() => setViewMode("cards")} 
        className={`p-2 rounded-full ${viewMode === "cards" ? "bg-red-900 text-white" : "bg-gray-200 text-gray-700"}`}>
        <Squares2X2Icon className="h-6 w-6" />
      </button>
    </div>
  );
};

export default ToggleView;
