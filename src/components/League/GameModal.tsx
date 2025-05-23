import React, { useEffect, useRef, useState } from "react";
import type { Player } from "../../types/player";
import ScorePanel from "./ScorePanel";

interface Props {
  teamA: Player[];
  teamB: Player[];
  onClose: () => void;
  onFinish: (winnerTeam: Player[] | null) => void;
}

const GameModal: React.FC<Props> = ({ teamA, teamB, onClose, onFinish }) => {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [foulsA, setFoulsA] = useState(0);
  const [foulsB, setFoulsB] = useState(0);
  const [maxPoints, setMaxPoints] = useState(21);
  const [timeLimit] = useState(10 * 60);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => setTimeLeft(timeLimit), [timeLimit]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            if (scoreA > scoreB) onFinish(teamA);
            else if (scoreB > scoreA) onFinish(teamB);
            else setTimeLeft(2 * 60); // tiempo extra
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current!);
    }
    return () => clearInterval(intervalRef.current!);
  }, [isRunning]);

  useEffect(() => {
    if (scoreA >= maxPoints) onFinish(teamA);
    if (scoreB >= maxPoints) onFinish(teamB);
  }, [scoreA, scoreB]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-2">
      <div
        className={`bg-white rounded-2xl shadow-xl p-4 w-full max-w-5xl space-y-6 relative ${
          isFullscreen ? "h-screen flex flex-col justify-center" : ""
        }`}
      >
        {/* ✅ Reemplazo de Scoreboard + ControlPanel */}
        <ScorePanel
            scoreA={scoreA}
            scoreB={scoreB}
            foulsA={foulsA}
            foulsB={foulsB}
            time={formatTime(timeLeft)}
            isRunning={isRunning}
            maxPoints={maxPoints}
            isFullscreen={isFullscreen}
            onStartPause={() => setIsRunning((prev) => !prev)}
            onReset={() => {
                setIsRunning(false);
                setTimeLeft(timeLimit);
            }}
            onMaxPointsChange={setMaxPoints}
            onScoreA={() => setScoreA((s) => s + 1)}
            onUnscoreA={() => setScoreA((s) => Math.max(0, s - 1))}
            onFoulA={() => setFoulsA((f) => f + 1)}
            onScoreB={() => setScoreB((s) => s + 1)}
            onUnscoreB={() => setScoreB((s) => Math.max(0, s - 1))}
            onFoulB={() => setFoulsB((f) => f + 1)}
            />

        {/* Cerrar */}
        <button
          onClick={() => {
            setIsRunning(false);
            onClose();
          }}
          className="absolute top-2 right-4 text-gray-400 hover:text-gray-700 text-lg font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default GameModal;
