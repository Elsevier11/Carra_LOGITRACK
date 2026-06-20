import type { GridConfig } from './types';

export const SOLETTA_PILES = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
export const SOLETTA_MAX_LEVELS = 10;
export const SOLETTA_LEVEL_HEIGHT_PX = 20;
export const SOLETTA_DEFAULT_LENGTH = 200;

export const GRID_CONFIGS: Record<'VASCA' | 'SOLETTA', GridConfig> = {
  VASCA: {
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M', 'PARK1', 'PARK2', 'PARK3'],
    totalLength: 6838,
    rowLengths: {
      A: 6838,
      B: 6838,
      C: 6838,
      D: 6838,
      E: 4222,
      F: 4222,
      G: 4222,
      H: 4222,
      I: 4222,
      L: 5378,
      M: 5378,
      PARK1: 7000,
      PARK2: 7000,
      PARK3: 7000
    },
    pixelsPerMeter: 0.08
  },
  SOLETTA: {
    rows: SOLETTA_PILES,
    totalLength: 1000,
    pixelsPerMeter: 1
  }
};

export const TANK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
];

export const CATEGORY_LABELS = {
  VASCA: { tab: 'Vasche', singular: 'vasca', plural: 'Vasche' },
  SOLETTA: { tab: 'Solette', singular: 'soletta', plural: 'Solette' },
} as const;

export const NETWORK_ERROR_MESSAGE = 'Errore di rete o del server';
