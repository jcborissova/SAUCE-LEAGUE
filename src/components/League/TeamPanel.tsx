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
  const bgColor =
    color === "blue"
      ? "from-[hsl(var(--primary)/0.08)] via-[hsl(var(--surface-1))]"
      : "from-[hsl(var(--success)/0.12)] via-[hsl(var(--surface-1))]";
  const textColor = color === "blue" ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--success))]";
  const buttonColor =
    color === "blue"
      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
      : "bg-[hsl(var(--success))] text-[hsl(var(--primary-foreground))]";

  return (
    <div className={`bg-gradient-to-br ${bgColor} rounded-[10px] border px-6 py-4 text-center shadow-[0_1px_0_hsl(var(--border)/0.32)]`}>
      <h3 className={`mb-2 text-lg font-bold tracking-wide ${textColor}`}>
        {teamLabel}
      </h3>

      <div className="text-4xl font-extrabold text-[hsl(var(--text-strong))]">{score}</div>
      <div className="text-sm text-[hsl(var(--text-subtle))]">Faltas: {fouls}</div>

      <div className="flex flex-wrap justify-center gap-2 mt-4">
        <button
          onClick={onScore}
          className={`${buttonColor} rounded-[8px] px-4 py-2 text-sm font-semibold shadow transition hover:opacity-90`}
        >
          +1
        </button>
        <button
          onClick={onUnscore}
          className="rounded-[8px] border bg-[hsl(var(--muted))] px-4 py-2 text-sm font-semibold text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--muted)/0.8)]"
        >
          -1
        </button>
        <button
          onClick={onFoul}
          className="rounded-[8px] bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow transition hover:opacity-90"
        >
          Foul
        </button>
      </div>
    </div>
  );
};

export default TeamPanel;
