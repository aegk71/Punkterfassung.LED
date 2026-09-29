import JSZip from 'jszip';
import type { Bericht, Foto, Punkt } from '../model';
import { db } from '../db';

const SCHEMA_VERSION = 1;

interface BerichtJson {
  schemaVersion: number;
  bericht: Bericht;
  punkte: Punkt[];
  fotos: Array<Omit<Foto, 'blob'>>;
}

export async function berichtAlsZip(bericht: Bericht, punkte: Punkt[], fotos: Foto[]): Promise<Blob> {
  const zip = new JSZip();
  const fotosMeta: Array<Omit<Foto, 'blob'>> = [];

  for (const foto of fotos) {
    const { blob, ...meta } = foto;
    fotosMeta.push(meta);
    zip.file(`fotos/${foto.id}.jpg`, blob);
  }

  const inhalt: BerichtJson = { schemaVersion: SCHEMA_VERSION, bericht, punkte, fotos: fotosMeta };
  zip.file('bericht.json', JSON.stringify(inhalt, null, 2));

  return zip.generateAsync({ type: 'blob' });
}

async function inhaltLesen(datei: Blob): Promise<{ zip: JSZip; inhalt: BerichtJson }> {
  const zip = await JSZip.loadAsync(datei);
  const jsonDatei = zip.file('bericht.json');
  if (!jsonDatei) throw new Error('Ungültiges Backup: bericht.json fehlt.');
  const inhalt = JSON.parse(await jsonDatei.async('string')) as BerichtJson;
  if (inhalt.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('Nicht unterstützte Backup-Version.');
  }
  return { zip, inhalt };
}

export async function zipVorabPruefen(datei: Blob): Promise<{ bericht: Bericht; kollision: boolean }> {
  const { inhalt } = await inhaltLesen(datei);
  const bestehend = await db.berichte.get(inhalt.bericht.id);
  return { bericht: inhalt.bericht, kollision: !!bestehend };
}

export type ZipImportModus = 'ersetzen' | 'kopie';

export async function zipImportieren(datei: Blob, modus: ZipImportModus): Promise<string> {
  const { zip, inhalt } = await inhaltLesen(datei);

  const idMap = new Map<string, string>();
  const neueBerichtId = modus === 'kopie' ? crypto.randomUUID() : inhalt.bericht.id;
  idMap.set(inhalt.bericht.id, neueBerichtId);

  const neuerBericht: Bericht = { ...inhalt.bericht, id: neueBerichtId };

  const neuePunkte: Punkt[] = inhalt.punkte.map((p) => {
    const neuePunktId = modus === 'kopie' ? crypto.randomUUID() : p.id;
    idMap.set(p.id, neuePunktId);
    return { ...p, id: neuePunktId, berichtId: neueBerichtId };
  });

  const neueFotos: Foto[] = [];
  for (const fotoMeta of inhalt.fotos) {
    const bilddatei = zip.file(`fotos/${fotoMeta.id}.jpg`);
    if (!bilddatei) continue;
    const arrayBuffer = await bilddatei.async('arraybuffer');
    const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
    const neueFotoId = modus === 'kopie' ? crypto.randomUUID() : fotoMeta.id;
    const neuePunktId = idMap.get(fotoMeta.punktId) ?? fotoMeta.punktId;
    neueFotos.push({ ...fotoMeta, id: neueFotoId, punktId: neuePunktId, blob });
  }

  await db.transaction('rw', db.berichte, db.punkte, db.fotos, async () => {
    if (modus === 'ersetzen') {
      const altePunkte = await db.punkte.where('berichtId').equals(neueBerichtId).toArray();
      const altePunktIds = altePunkte.map((p) => p.id);
      if (altePunktIds.length > 0) {
        await db.fotos.where('punktId').anyOf(altePunktIds).delete();
      }
      await db.punkte.where('berichtId').equals(neueBerichtId).delete();
    }
    await db.berichte.put(neuerBericht);
    await db.punkte.bulkPut(neuePunkte);
    await db.fotos.bulkPut(neueFotos);
  });

  return neueBerichtId;
}
