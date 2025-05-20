// components/League/ScorePanel.tsx
import React from "react";

interface Props {
  scoreA: number;
  scoreB: number;
  foulsA: number;
  foulsB: number;
  time: string;
  isRunning: boolean;
  maxPoints: number;
  isFullscreen?: boolean;
  onStartPause: () => void;
  onReset: () => void;
  onMaxPointsChange: (value: number) => void;
  onScoreA: () => void;
  onUnscoreA: () => void;
  onFoulA: () => void;
  onScoreB: () => void;
  onUnscoreB: () => void;
  onFoulB: () => void;
}

const ScorePanel: React.FC<Props> = ({
  scoreA,
  scoreB,
  foulsA,
  foulsB,
  time,
  isRunning,
  maxPoints,
  isFullscreen,
  onStartPause,
  onReset,
  onMaxPointsChange,
  onScoreA,
  onUnscoreA,
  onFoulA,
  onScoreB,
  onUnscoreB,
  onFoulB,
}) => {
  return (
    <div
      className={`bg-white px-4 py-6 w-full max-w-5xl mx-auto space-y-6 ${
        isFullscreen ? "text-xl sm:text-2xl" : "text-base"
      }`}
    >
      {/* Tiempo y puntos meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center sm:text-left items-center">
        <div>
          <p className="text-sm text-gray-500">⏱ Tiempo</p>
          <p className="font-bold text-3xl text-blue-900">{time}</p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
            <button
              onClick={onStartPause}
              className={`px-4 py-1 rounded-full text-sm font-semibold shadow ${
                isRunning ? "bg-yellow-500 text-white" : "bg-blue-800 text-white"
              } hover:opacity-90 transition`}
            >
              {isRunning ? "Pausar" : "Iniciar"}
            </button>
            <button
              onClick={onReset}
              className="px-4 py-1 rounded-full text-sm font-semibold bg-gray-200 text-gray-800 hover:bg-gray-300 transition"
            >
              Reiniciar
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500">🎯 Puntos Meta</p>
          <input
            type="number"
            value={maxPoints}
            onChange={(e) => onMaxPointsChange(Number(e.target.value))}
            className="mt-1 border rounded-lg px-3 py-2 text-center text-lg font-semibold text-blue-800 shadow-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Paneles de equipos */}
      <div className="flex flex-col sm:flex-row gap-6 text-center">
        {/* Equipo A */}
        <div className="flex-1 bg-blue-50 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-800">Equipo A</p>
          <p className="text-5xl font-bold text-blue-700">{scoreA}</p>
          <p className="text-sm text-gray-500">Faltas</p>
          <p className="text-2xl text-red-600 font-semibold">{foulsA}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <button
              onClick={onScoreA}
              className="bg-blue-800 text-white px-4 py-1 rounded text-sm font-medium"
            >
              +1
            </button>
            <button
              onClick={onUnscoreA}
              className="bg-gray-700 text-white px-4 py-1 rounded text-sm font-medium"
            >
              -1
            </button>
            <button
              onClick={onFoulA}
              className="bg-red-600 text-white px-4 py-1 rounded text-sm font-medium"
            >
              Foul
            </button>
          </div>
        </div>

        {/* Equipo B */}
        <div className="flex-1 bg-green-50 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-green-800">Equipo B</p>
          <p className="text-5xl font-bold text-green-700">{scoreB}</p>
          <p className="text-sm text-gray-500">Faltas</p>
          <p className="text-2xl text-red-600 font-semibold">{foulsB}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <button
              onClick={onScoreB}
              className="bg-green-800 text-white px-4 py-1 rounded text-sm font-medium"
            >
              +1
            </button>
            <button
              onClick={onUnscoreB}
              className="bg-gray-700 text-white px-4 py-1 rounded text-sm font-medium"
            >
              -1
            </button>
            <button
              onClick={onFoulB}
              className="bg-red-600 text-white px-4 py-1 rounded text-sm font-medium"
            >
              Foul
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScorePanel;
