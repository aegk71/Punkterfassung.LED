const zustandProBericht = new Map<string, Set<string>>();

export function holeEingeklappt(berichtId: string): Set<string> {
  return new Set(zustandProBericht.get(berichtId) ?? []);
}

export function setzeEingeklappt(berichtId: string, anlagen: Set<string>): void {
  zustandProBericht.set(berichtId, new Set(anlagen));
}
