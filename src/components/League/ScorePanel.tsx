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
    <section className={`w-full space-y-4 ${isFullscreen ? "text-lg" : "text-base"}`}>
      <header className="grid grid-cols-1 gap-3 border bg-[hsl(var(--surface-1))] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Tiempo</p>
            <p className="text-3xl font-black tabular-nums sm:text-4xl">{time}</p>
          </div>
          <span className="h-8 w-px bg-[hsl(var(--border))]" />
          <div>
            <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Meta</p>
            <input
              type="number"
              value={maxPoints}
              onChange={(e) => onMaxPointsChange(Number(e.target.value))}
              className="input-base w-20 text-center text-base font-semibold"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button onClick={onStartPause} className={isRunning ? "btn-secondary" : "btn-primary"}>
            {isRunning ? "Pausar" : "Iniciar"}
          </button>
          <button onClick={onReset} className="btn-secondary">
            Reiniciar
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TeamBox
          label="Equipo A"
          score={scoreA}
          fouls={foulsA}
          accent="primary"
          onScore={onScoreA}
          onUnscore={onUnscoreA}
          onFoul={onFoulA}
        />
        <TeamBox
          label="Equipo B"
          score={scoreB}
          fouls={foulsB}
          accent="success"
          onScore={onScoreB}
          onUnscore={onUnscoreB}
          onFoul={onFoulB}
        />
      </div>
    </section>
  );
};

const TeamBox = ({
  label,
  score,
  fouls,
  accent,
  onScore,
  onUnscore,
  onFoul,
}: {
  label: string;
  score: number;
  fouls: number;
  accent: "primary" | "success";
  onScore: () => void;
  onUnscore: () => void;
  onFoul: () => void;
}) => {
  const accentColor = accent === "primary" ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--success))]";
  const scoreColor = accent === "primary" ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--success))]";

  return (
    <article className="border bg-[hsl(var(--surface-1))] p-4">
      <p className={`text-sm font-semibold ${accentColor}`}>{label}</p>
      <p className={`mt-1 text-6xl font-black tabular-nums ${scoreColor}`}>{score}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Faltas</p>
      <p className="text-2xl font-semibold text-[hsl(var(--destructive))] tabular-nums">{fouls}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onScore} className="btn-primary min-w-[68px]">
          +1
        </button>
        <button onClick={onUnscore} className="btn-secondary min-w-[68px]">
          -1
        </button>
        <button onClick={onFoul} className="btn-danger min-w-[68px]">
          Foul
        </button>
      </div>
    </article>
  );
};

export default ScorePanel;
