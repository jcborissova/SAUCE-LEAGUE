const normalizePlayerName = (name: string): string =>
  name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

const truncateWithDots = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
};

export const getPlayerInitials = (name: string): string => {
  const normalized = normalizePlayerName(name);
  if (!normalized) return "JG";

  return (
    normalized
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "JG"
  );
};

export const abbreviateLeaderboardName = (name: string, maxLength = 20): string => {
  const normalized = normalizePlayerName(name);
  if (!normalized) return "Jugador";
  if (normalized.length <= maxLength) return normalized;

  const parts = normalized.split(" ");
  if (parts.length === 1) return truncateWithDots(normalized, maxLength);

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const firstLastInitial = `${firstName} ${lastName[0]?.toUpperCase() ?? ""}.`;
  if (firstLastInitial.length <= maxLength) return firstLastInitial;

  const firstAndInitials = `${firstName} ${parts
    .slice(1)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}.`)
    .join(" ")}`;
  if (firstAndInitials.length <= maxLength) return firstAndInitials;

  return `${truncateWithDots(firstName, Math.max(4, maxLength - 4))} ${lastName[0]?.toUpperCase() ?? ""}.`;
};

