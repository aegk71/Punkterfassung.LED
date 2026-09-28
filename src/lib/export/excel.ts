import ExcelJS from 'exceljs';
import type { Bericht, Foto, Punkt, PunktStatus } from '../model';
import { formatDeutsch } from '../datum';
import { lageText } from '../lage';
import { pfeilInBildRendern } from './pfeilRendern';

const STATUS_TEXT: Record<PunktStatus, string> = {
  offen: 'offen',
  in_bearbeitung: 'in Bearbeitung',
  erledigt: 'erledigt',
};

const STATUS_FARBEN: Record<'offen' | 'in_bearbeitung' | 'erledigt' | 'geloescht', { bg: string; font: string }> = {
  offen: { bg: 'FFFBEAE8', font: 'FFC0392B' },
  in_bearbeitung: { bg: 'FFFAF1DC', font: 'FFB5860B' },
  erledigt: { bg: 'FFE3EFE8', font: 'FF1D6B45' },
  geloescht: { bg: 'FFECEEF0', font: 'FF6B7280' },
};

function isoDatumDeutsch(isoDatumZeit: string | undefined): string {
  if (!isoDatumZeit) return '';
  return formatDeutsch(isoDatumZeit.slice(0, 10));
}

async function blobZuBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binaer = '';
  for (let i = 0; i < bytes.length; i++) binaer += String.fromCharCode(bytes[i]);
  return btoa(binaer);
}

export async function berichtAlsExcel(
  bericht: Bericht,
  punkte: Punkt[],
  fotosProPunkt: Map<string, Foto[]>,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const blatt = workbook.addWorksheet('Punkte');

  const kopfFelder: [string, string][] = [
    ['Projekt-Nr.', bericht.projektNr],
    ['Projektname', bericht.projektName],
    ['Vorgang', bericht.vorgang],
    ['Beschreibung', bericht.beschreibung],
    ['Neubau-Nr.', bericht.neubauNr ?? ''],
    ['Neubau-Name', bericht.neubauName ?? ''],
    ['Ort', bericht.ort ?? ''],
    ['Ersteller', bericht.ersteller],
    ['Datum', formatDeutsch(bericht.datum)],
  ];

  kopfFelder.forEach(([label, wert]) => {
    const zeile = blatt.addRow([label, wert]);
    zeile.getCell(1).font = { bold: true };
  });
  blatt.addRow([]);

  const spalten = [
    'Anlage',
    'Pkt.-Nr.',
    'Lage',
    'BG',
    'Status',
    'Anmerkung',
    'Foto 1',
    'Foto 2',
    'Foto 3',
    'erfasst am',
    'erledigt am',
    'Gelöscht',
  ];
  const kopfZeileIndex = blatt.rowCount + 1;
  const kopfZeile = blatt.addRow(spalten);
  kopfZeile.font = { bold: true };
  kopfZeile.eachCell((zelle) => {
    zelle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF4' } };
  });

  blatt.columns = [
    { width: 12 },
    { width: 9 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 32 },
    { width: 19 },
    { width: 19 },
    { width: 19 },
    { width: 12 },
    { width: 12 },
    { width: 30 },
  ];

  const punkteSortiert = [...punkte].sort((a, b) => {
    const anlageVergleich = a.anlageNr.localeCompare(b.anlageNr, undefined, { numeric: true });
    return anlageVergleich !== 0 ? anlageVergleich : a.nr - b.nr;
  });

  for (const punkt of punkteSortiert) {
    const statusSchluessel = punkt.geloescht ? 'geloescht' : punkt.status;
    const statusText = punkt.geloescht ? 'gelöscht' : STATUS_TEXT[punkt.status];
    const gelöschtText = punkt.geloescht
      ? `${isoDatumDeutsch(punkt.geloescht.am)} durch ${punkt.geloescht.durch}${punkt.geloescht.grund ? ` – ${punkt.geloescht.grund}` : ''}`
      : '';

    const zeile = blatt.addRow([
      punkt.anlageNr,
      punkt.nr,
      lageText(punkt.lage),
      punkt.baugruppeName,
      statusText,
      punkt.anmerkung ?? '',
      '',
      '',
      '',
      isoDatumDeutsch(punkt.erstelltAm),
      isoDatumDeutsch(punkt.erledigtAm),
      gelöschtText,
    ]);

    const statusZelle = zeile.getCell(5);
    const farben = STATUS_FARBEN[statusSchluessel];
    statusZelle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: farben.bg } };
    statusZelle.font = { color: { argb: farben.font }, bold: true };
    statusZelle.dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"offen,in Bearbeitung,erledigt,gelöscht"'],
    };

    const fotos = (fotosProPunkt.get(punkt.id) ?? []).slice().sort((a, b) => a.reihenfolge - b.reihenfolge);
    if (fotos.length > 0) zeile.height = 75;

    for (const foto of fotos) {
      const bildBlob = foto.pfeil ? await pfeilInBildRendern(foto.blob, foto.pfeil) : foto.blob;
      const base64 = await blobZuBase64(bildBlob);
      const imageId = workbook.addImage({ base64, extension: 'jpeg' });

      const maxBreite = 130;
      const maxHoehe = 95;
      const skalierung = Math.min(maxBreite / foto.breite, maxHoehe / foto.hoehe, 1);
      const breite = foto.breite * skalierung;
      const hoehe = foto.hoehe * skalierung;

      const spalteIndex = 6 + (foto.reihenfolge - 1);
      blatt.addImage(imageId, {
        tl: { col: spalteIndex, row: zeile.number - 1 },
        ext: { width: breite, height: hoehe },
      });
    }
  }

  blatt.autoFilter = {
    from: { row: kopfZeileIndex, column: 1 },
    to: { row: kopfZeileIndex, column: spalten.length },
  };
  blatt.views = [{ state: 'frozen', ySplit: kopfZeileIndex }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
