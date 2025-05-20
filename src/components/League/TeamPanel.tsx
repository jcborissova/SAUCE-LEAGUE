// components/League/TeamPanel.tsx
import React from "react";

interface Props {
  teamLabel: string;
  score: number;
  fouls: number;
  onScore: () => void;
  onUnscore: () => void;
  onFoul: () => void;
  color?: "blue" | "green";
}

const TeamPanel: React.FC<Props> = ({
  teamLabel,
  score,
  fouls,
  onScore,
  onUnscore,
  onFoul,
  color = "blue",
}) => {
  const bgColor = color === "blue" ? "bg-blue-100" : "bg-green-100";
  const textColor = color === "blue" ? "text-blue-800" : "text-green-800";
  const buttonColor = color === "blue" ? "bg-blue-800" : "bg-green-800";

  return (
    <div className={`${bgColor} rounded-xl px-6 py-4 text-center shadow-sm`}>
      <h3 className={`text-lg font-bold ${textColor} mb-2 tracking-wide`}>
        {teamLabel}
      </h3>

      <div className="text-4xl font-extrabold text-gray-900">{score}</div>
      <div className="text-sm text-gray-500">Faltas: {fouls}</div>

      <div className="flex flex-wrap justify-center gap-2 mt-4">
        <button
          onClick={onScore}
          className={`${buttonColor} text-white px-4 py-1 rounded-lg text-sm font-semibold hover:opacity-90 transition`}
        >
          +1
        </button>
        <button
          onClick={onUnscore}
          className="bg-gray-700 text-white px-4 py-1 rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
        >
          -1
        </button>
        <button
          onClick={onFoul}
          className="bg-red-600 text-white px-4 py-1 rounded-lg text-sm font-semibold hover:bg-red-700 transition"
        >
          Foul
        </button>
      </div>
    </div>
  );
};

export default TeamPanel;
