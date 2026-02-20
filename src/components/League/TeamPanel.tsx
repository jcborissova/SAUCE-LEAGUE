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
      ? "from-[hsl(var(--primary)/0.15)] via-[hsl(var(--primary)/0.05)]"
      : "from-[hsl(var(--success)/0.20)] via-[hsl(var(--success)/0.08)]";
  const textColor = color === "blue" ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--success))]";
  const buttonColor =
    color === "blue"
      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
      : "bg-[hsl(var(--success))] text-[hsl(var(--primary-foreground))]";

  return (
    <div className={`bg-gradient-to-br ${bgColor} rounded-xl px-6 py-4 text-center shadow-sm border`}>
      <h3 className={`text-lg font-bold ${textColor} mb-2 tracking-wide`}>
        {teamLabel}
      </h3>

      <div className="text-4xl font-extrabold text-[hsl(var(--text-strong))]">{score}</div>
      <div className="text-sm text-[hsl(var(--text-subtle))]">Faltas: {fouls}</div>

      <div className="flex flex-wrap justify-center gap-2 mt-4">
        <button
          onClick={onScore}
          className={`${buttonColor} px-4 py-2 rounded-lg text-sm font-semibold shadow hover:opacity-90 transition`}
        >
          +1
        </button>
        <button
          onClick={onUnscore}
          className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-[hsl(var(--muted)/0.80)] transition"
        >
          -1
        </button>
        <button
          onClick={onFoul}
          className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-semibold shadow hover:opacity-90 transition"
        >
          Foul
        </button>
      </div>
    </div>
  );
};

export default TeamPanel;
