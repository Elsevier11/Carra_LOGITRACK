import type { GridConfig } from './types';

export const SOLETTA_PILES = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
export const SOLETTA_MAX_LEVELS = 10;
export const SOLETTA_LEVEL_HEIGHT_PX = 20;
export const SOLETTA_DEFAULT_LENGTH = 200;

export const GRID_CONFIGS: Record<'VASCA' | 'SOLETTA', GridConfig> = {
  VASCA: {
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M'],
    totalLength: 6338,
    rowLengths: {
      A: 6338,
      B: 6338,
      C: 6338,
      D: 6338,
      E: 3722,
      F: 3722,
      G: 3722,
      H: 3722,
      I: 3722,
      L: 4878,
      M: 4878
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
