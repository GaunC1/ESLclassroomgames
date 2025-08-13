export type Round = {
  title: string;
  targets: string[];
};

export type GeneratedGame = {
  name: string;
  description: string;
  rounds: Round[];
  notes?: string;
};

export type GameListItem = { id: number; name: string; description?: string | null; roundsCount: number };

