import type { Lage } from './model';

export function lageWinkel(lage: Lage): number {
  if (lage === 'M') return 0;
  return (lage % 12) * 30;
}

export function lageText(lage: Lage): string {
  return lage === 'M' ? 'generell' : `${lage} Uhr`;
}
