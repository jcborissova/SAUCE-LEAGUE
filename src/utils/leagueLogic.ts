import type { Player } from '../types/player';

interface WinnerStreak {
  team: Player[];
  wins: number;
}

export const generateGameQueue = (players: Player[]): Player[][] => {
  const ordered = [...players].sort((a, b) => (a.arrivalTime ?? 0) - (b.arrivalTime ?? 0));
  const groups: Player[][] = [];
  for (let i = 0; i < ordered.length; i += 5) {
    if (i + 5 <= ordered.length) {
      groups.push(ordered.slice(i, i + 5));
    }
  }
  return groups;
};

export const updateWinnerStreak = (
  currentStreak: WinnerStreak | null,
  winningTeam: Player[]
): WinnerStreak | null => {
  if (
    currentStreak &&
    currentStreak.team.every((p) => winningTeam.some((w) => w.id === p.id))
  ) {
    const newWins = currentStreak.wins + 1;
    return { team: winningTeam, wins: newWins };
  } else {
    return { team: winningTeam, wins: 1 };
  }
};
