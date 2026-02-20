/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import type { Player } from "../../types/player";
import ScorePanel from "./ScorePanel";

type LeaguePlayer = Player & {
  order_number: number;
  isGuest?: boolean;
};

interface Props {
  teamA: LeaguePlayer[];
  teamB: LeaguePlayer[];
  onClose: () => void;
  onFinish: (winnerTeam: "A" | "B" | "DRAW") => void;
}

const GameModal: React.FC<Props> = ({ onClose, onFinish }) => {
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [foulsA, setFoulsA] = useState(0);
  const [foulsB, setFoulsB] = useState(0);
  const [maxPoints, setMaxPoints] = useState(21);

  const regularTime = 10 * 60;
  const extraTime = 2 * 60;

  const [timeLeft, setTimeLeft] = useState(regularTime);
  const [isRunning, setIsRunning] = useState(false);
  const [isExtraTime, setIsExtraTime] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);

            if (scoreA > scoreB) onFinish("A");
            else if (scoreB > scoreA) onFinish("B");
            else if (!isExtraTime) {
              setIsExtraTime(true);
              setTimeLeft(extraTime);
              setIsRunning(true);
            } else {
              onFinish("DRAW");
            }

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current!);
    }

    return () => clearInterval(intervalRef.current!);
  }, [isRunning, scoreA, scoreB, isExtraTime]);

  useEffect(() => {
    if (scoreA >= maxPoints) onFinish("A");
    else if (scoreB >= maxPoints) onFinish("B");
  }, [scoreA, scoreB]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-2 sm:px-4">
      <div className="card rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-5xl space-y-6 relative">
        <ScorePanel
          scoreA={scoreA}
          scoreB={scoreB}
          foulsA={foulsA}
          foulsB={foulsB}
          time={formatTime(timeLeft)}
          isRunning={isRunning}
          maxPoints={maxPoints}
          onStartPause={() => setIsRunning((prev) => !prev)}
          onReset={() => {
            setIsRunning(false);
            setTimeLeft(isExtraTime ? extraTime : regularTime);
          }}
          onMaxPointsChange={setMaxPoints}
          onScoreA={() => setScoreA((s) => s + 1)}
          onUnscoreA={() => setScoreA((s) => Math.max(0, s - 1))}
          onFoulA={() => setFoulsA((f) => f + 1)}
          onScoreB={() => setScoreB((s) => s + 1)}
          onUnscoreB={() => setScoreB((s) => Math.max(0, s - 1))}
          onFoulB={() => setFoulsB((f) => f + 1)}
        />

        <button
          onClick={() => {
            setIsRunning(false);
            onClose();
          }}
          className="absolute top-3 right-4 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] text-lg font-bold"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default GameModal;
