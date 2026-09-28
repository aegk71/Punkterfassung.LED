import type { Lage } from './model';

export interface TuerSegment {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

export function tuerSegment(lage: Lage, breite: number, hoehe: number, rahmen: number): TuerSegment {
  const innenHoehe = hoehe - 2 * rahmen;
  const drittelH = innenHoehe / 3;
  const drittelW = breite / 3;

  switch (lage) {
    case 11:
      return { x: 0, y: 0, breite: drittelW, hoehe: rahmen };
    case 12:
      return { x: drittelW, y: 0, breite: drittelW, hoehe: rahmen };
    case 1:
      return { x: 2 * drittelW, y: 0, breite: drittelW, hoehe: rahmen };
    case 2:
      return { x: breite - rahmen, y: rahmen, breite: rahmen, hoehe: drittelH };
    case 3:
      return { x: breite - rahmen, y: rahmen + drittelH, breite: rahmen, hoehe: drittelH };
    case 4:
      return { x: breite - rahmen, y: rahmen + 2 * drittelH, breite: rahmen, hoehe: drittelH };
    case 5:
      return { x: 2 * drittelW, y: hoehe - rahmen, breite: drittelW, hoehe: rahmen };
    case 6:
      return { x: drittelW, y: hoehe - rahmen, breite: drittelW, hoehe: rahmen };
    case 7:
      return { x: 0, y: hoehe - rahmen, breite: drittelW, hoehe: rahmen };
    case 8:
      return { x: 0, y: rahmen + 2 * drittelH, breite: rahmen, hoehe: drittelH };
    case 9:
      return { x: 0, y: rahmen + drittelH, breite: rahmen, hoehe: drittelH };
    case 10:
      return { x: 0, y: rahmen, breite: rahmen, hoehe: drittelH };
    case 'M':
      return { x: rahmen, y: rahmen, breite: breite - 2 * rahmen, hoehe: hoehe - 2 * rahmen };
  }
}

export function segmentMitte(s: TuerSegment): { x: number; y: number } {
  return { x: s.x + s.breite / 2, y: s.y + s.hoehe / 2 };
}
