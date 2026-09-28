import Dexie, { type Table } from 'dexie';
import type { Bericht, Einstellungen, Foto, Punkt } from './model';
import { STANDARD_BAUGRUPPEN } from './model';

export class AppDatabase extends Dexie {
  einstellungen!: Table<Einstellungen, string>;
  berichte!: Table<Bericht, string>;
  punkte!: Table<Punkt, string>;
  fotos!: Table<Foto, string>;

  constructor() {
    super('punkterfassung');
    this.version(1).stores({
      einstellungen: 'id',
      berichte: 'id, projektNr, status, geaendertAm',
      punkte: 'id, berichtId, [berichtId+nr], anlageNr',
      fotos: 'id, punktId, reihenfolge',
    });
  }
}

export const db = new AppDatabase();

export async function ladeEinstellungen(): Promise<Einstellungen> {
  const bestehend = await db.einstellungen.get('global');
  if (bestehend) return bestehend;

  const standard: Einstellungen = {
    id: 'global',
    ersteller: '',
    baugruppen: STANDARD_BAUGRUPPEN.map((name, index) => ({
      id: crypto.randomUUID(),
      name,
      aktiv: true,
      sortierung: index,
    })),
  };
  await db.einstellungen.put(standard);
  return standard;
}
