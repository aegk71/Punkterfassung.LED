import type { Lage } from './model';

export function lageText(lage: Lage): string {
  return lage === 'M' ? 'generell' : `${lage} Uhr`;
}
