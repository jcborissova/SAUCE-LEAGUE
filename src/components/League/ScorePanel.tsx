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
      className={`card px-4 py-6 w-full max-w-5xl mx-auto space-y-6 transition-colors ${
        isFullscreen ? "text-xl sm:text-2xl" : "text-base"
      }`}
    >
      {/* Tiempo y puntos meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center sm:text-left items-center">
        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">⏱ Tiempo</p>
          <p className="font-bold text-3xl">{time}</p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
            <button
              onClick={onStartPause}
              className={`px-4 py-2 rounded-full text-sm font-semibold shadow ${
                isRunning ? "bg-[hsl(var(--warning))] text-[hsl(var(--foreground))]" : "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              } hover:opacity-90 transition`}
            >
              {isRunning ? "Pausar" : "Iniciar"}
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 rounded-full text-sm font-semibold border text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition"
            >
              Reiniciar
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">🎯 Puntos meta</p>
          <input
            type="number"
            value={maxPoints}
            onChange={(e) => onMaxPointsChange(Number(e.target.value))}
            className="mt-1 border rounded-lg px-3 py-2 text-center text-lg font-semibold shadow-sm w-28 bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
      </div>

      {/* Paneles de equipos */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-center">
        {/* Equipo A */}
        <div className="flex-1 rounded-2xl p-5 space-y-2 border bg-gradient-to-br from-[hsl(var(--primary)/0.10)] via-[hsl(var(--primary)/0.5)] to-transparent">
          <p className="text-sm font-semibold text-[hsl(var(--primary))]">Equipo A</p>
          <p className="text-5xl sm:text-6xl font-black">{scoreA}</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Faltas</p>
          <p className="text-2xl sm:text-3xl text-destructive font-semibold">{foulsA}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <button
              onClick={onScoreA}
              className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 rounded-lg text-sm font-semibold shadow hover:opacity-90"
            >
              +1
            </button>
            <button
              onClick={onUnscoreA}
              className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-[hsl(var(--muted)/0.80)]"
            >
              -1
            </button>
            <button
              onClick={onFoulA}
              className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-semibold shadow hover:opacity-90"
            >
              Foul
            </button>
          </div>
        </div>

        {/* Equipo B */}
        <div className="flex-1 rounded-2xl p-5 space-y-2 border bg-gradient-to-br from-[hsl(var(--success)/0.20)] via-[hsl(var(--success)/0.08)] to-transparent">
          <p className="text-sm font-semibold text-[hsl(var(--success))]">Equipo B</p>
          <p className="text-5xl sm:text-6xl font-black text-[hsl(var(--success))]">{scoreB}</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Faltas</p>
          <p className="text-2xl sm:text-3xl text-destructive font-semibold">{foulsB}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <button
              onClick={onScoreB}
              className="bg-[hsl(var(--success))] text-[hsl(var(--primary-foreground))] px-4 py-2 rounded-lg text-sm font-semibold shadow hover:opacity-90"
            >
              +1
            </button>
            <button
              onClick={onUnscoreB}
              className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-[hsl(var(--muted)/0.80)]"
            >
              -1
            </button>
            <button
              onClick={onFoulB}
              className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-semibold shadow hover:opacity-90"
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
