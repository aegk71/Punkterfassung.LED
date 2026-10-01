export type Lage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'M';
export type PunktStatus = 'offen' | 'in_bearbeitung' | 'erledigt';
export type BerichtStatus = 'offen' | 'abgeschlossen';
export type BerichtSprache = 'de' | 'en';

export interface Baugruppe {
  id: string;
  name: string;
  aktiv: boolean;
  sortierung: number;
}

export interface Einstellungen {
  id: 'global';
  ersteller: string;
  baugruppen: Baugruppe[];
}

export interface Bericht {
  id: string;
  titel?: string;
  projektNr: string;
  projektName: string;
  vorgang: string;
  beschreibung: string;
  ersteller: string;
  datum: string;
  neubauNr?: string;
  neubauName?: string;
  ort?: string;
  status: BerichtStatus;
  sprache: BerichtSprache;
  naechstePunktNr: number;
  letzteSicherung?: string;
  erstelltAm: string;
  geaendertAm: string;
}

export interface Punkt {
  id: string;
  berichtId: string;
  nr: number;
  anlageNr: string;
  lage: Lage;
  baugruppeId: string;
  baugruppeName: string;
  status: PunktStatus;
  erledigtAm?: string;
  anmerkung?: string;
  geloescht?: { am: string; durch: string; grund?: string };
  erstelltAm: string;
  geaendertAm: string;
}

export interface Foto {
  id: string;
  punktId: string;
  reihenfolge: 1 | 2 | 3;
  blob: Blob;
  breite: number;
  hoehe: number;
  pfeil?: { x1: number; y1: number; x2: number; y2: number };
  erstelltAm: string;
}

export const STANDARD_BAUGRUPPEN: readonly string[] = [
  'ANTRIEB',
  'ZARGE',
  'BLATT',
  'BODENF.',
  'SONSTIGES',
];
