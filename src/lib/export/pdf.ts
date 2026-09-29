import jsPDF from 'jspdf';
import type { Bericht, Foto, Lage, Punkt, PunktStatus } from '../model';
import { formatDeutsch } from '../datum';
import { berichtTexte, lageTextExport } from './berichtstexte';
import { naturalCompare } from '../naturalSort';
import { tuerSegment, segmentMitte } from '../tuer';
import { pfeilInBildRendern } from './pfeilRendern';
import { blobZuDataUrl, bildLaden, blobSicherLesen } from './bild';

const SEITE_BREITE = 210;
const SEITE_HOEHE = 297;
const RAND = 15;
const INHALT_BREITE = SEITE_BREITE - 2 * RAND;
const FOTO_MAX_HOEHE = 38;

const STATUS_FARBEN: Record<PunktStatus, { bg: [number, number, number]; text: [number, number, number] }> = {
  offen: { bg: [251, 234, 232], text: [192, 57, 43] },
  in_bearbeitung: { bg: [250, 241, 220], text: [181, 134, 11] },
  erledigt: { bg: [227, 239, 232], text: [29, 107, 69] },
};

function isoDatumDeutsch(isoDatumZeit: string | undefined): string {
  if (!isoDatumZeit) return '';
  return formatDeutsch(isoDatumZeit.slice(0, 10));
}

function zeichneLageSymbol(doc: jsPDF, x: number, y: number, lage: Lage): void {
  const breite = 7;
  const hoehe = 9.8;
  const rahmen = 2.1;
  doc.setDrawColor(140, 148, 158);
  doc.setLineWidth(0.2);
  doc.rect(x, y, breite, hoehe);
  doc.rect(x + rahmen, y + rahmen, breite - 2 * rahmen, hoehe - 2 * rahmen);
  doc.setFillColor(20, 56, 104);
  if (lage === 'M') {
    doc.circle(x + breite / 2, y + hoehe / 2, 0.9, 'F');
  } else {
    const segment = tuerSegment(lage, breite, hoehe, rahmen);
    const mitte = segmentMitte(segment);
    doc.circle(x + mitte.x, y + mitte.y, 0.7, 'F');
  }
}

export async function berichtAlsPdf(
  bericht: Bericht,
  punkte: Punkt[],
  fotosProPunkt: Map<string, Foto[]>,
): Promise<Blob> {
  const t = berichtTexte(bericht.sprache);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = await bildLaden(`${import.meta.env.BASE_URL}assets/lethe-logo.jpg`);
  const logoZielHoehe = 10;
  const logoZielBreite = logoZielHoehe * (logo.breite / logo.hoehe);

  const kopfUnten = RAND + logoZielHoehe + 4;
  const fussOben = SEITE_HOEHE - RAND - 10;
  let y = kopfUnten + 6;

  function kopfZeichnen(): void {
    doc.addImage(logo.dataUrl, 'JPEG', RAND, RAND, logoZielBreite, logoZielHoehe);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 56, 104);
    doc.text(`${bericht.projektNr} · ${bericht.vorgang}`, SEITE_BREITE - RAND, RAND + logoZielHoehe / 2 + 1.5, {
      align: 'right',
    });
    doc.setDrawColor(223, 228, 234);
    doc.setLineWidth(0.3);
    doc.line(RAND, kopfUnten, SEITE_BREITE - RAND, kopfUnten);
  }

  function neueSeite(): void {
    doc.addPage();
    kopfZeichnen();
    y = kopfUnten + 6;
  }

  function platzPruefen(benoetigteHoehe: number): void {
    if (y + benoetigteHoehe > fussOben) neueSeite();
  }

  kopfZeichnen();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 29, 33);
  doc.text(t.titel, RAND, y);
  y += 10;

  const deckblattFelder: [string, string][] = [
    [t.projektNr, bericht.projektNr],
    [t.projektName, bericht.projektName],
    [t.vorgang, bericht.vorgang],
    [t.beschreibung, bericht.beschreibung],
    [t.neubauNr, bericht.neubauNr ?? '–'],
    [t.neubauName, bericht.neubauName ?? '–'],
    [t.ort, bericht.ort ?? '–'],
    [t.ersteller, bericht.ersteller],
    [t.datum, formatDeutsch(bericht.datum)],
  ];

  doc.setFontSize(11);
  for (const [label, wert] of deckblattFelder) {
    platzPruefen(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(92, 102, 114);
    doc.text(label, RAND, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(26, 29, 33);
    doc.text(wert || '–', RAND + 42, y);
    y += 7;
  }

  const nichtGeloeschte = punkte.filter((p) => !p.geloescht);
  const geloeschtePunkte = punkte.filter((p) => p.geloescht);
  const zaehler = { offen: 0, in_bearbeitung: 0, erledigt: 0 };
  for (const p of nichtGeloeschte) zaehler[p.status]++;

  y += 4;
  platzPruefen(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 29, 33);
  doc.text(t.zusammenfassung, RAND, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const zusammenfassungTeile = [
    `${zaehler.offen} ${t.status.offen}`,
    `${zaehler.in_bearbeitung} ${t.status.in_bearbeitung}`,
    `${zaehler.erledigt} ${t.status.erledigt}`,
  ];
  if (geloeschtePunkte.length > 0) zusammenfassungTeile.push(`${geloeschtePunkte.length} ${t.status.geloescht}`);
  platzPruefen(7);
  doc.text(zusammenfassungTeile.join(' · '), RAND, y);
  y += 12;

  async function punktBlockZeichnen(punkt: Punkt): Promise<void> {
    const fotos = (fotosProPunkt.get(punkt.id) ?? []).slice().sort((a, b) => a.reihenfolge - b.reihenfolge);
    const anmerkungZeilen: string[] = punkt.anmerkung
      ? doc.splitTextToSize(punkt.anmerkung, INHALT_BREITE - 8)
      : [];

    const kopfOffset = 16;
    const anmerkungHoehe = anmerkungZeilen.length * 5;
    const fotoBereichHoehe = fotos.length > 0 ? FOTO_MAX_HOEHE + 4 : 0;
    const kartenHoehe = kopfOffset + anmerkungHoehe + fotoBereichHoehe + 4;
    const blockHoehe = kartenHoehe + 4;

    platzPruefen(blockHoehe);

    const blockStartY = y;
    doc.setDrawColor(223, 228, 234);
    doc.roundedRect(RAND, blockStartY, INHALT_BREITE, kartenHoehe, 2, 2, 'S');

    const innenX = RAND + 5;
    let innenY = blockStartY + 6.5;

    zeichneLageSymbol(doc, innenX, innenY - 6.5, punkt.lage);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 29, 33);
    doc.text(`#${punkt.nr}`, innenX + 11, innenY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(92, 102, 114);
    doc.text(lageTextExport(punkt.lage, bericht.sprache), innenX + 25, innenY);
    doc.text(punkt.baugruppeName, innenX + 55, innenY);

    const farben = STATUS_FARBEN[punkt.status];
    const statusTextWert = t.status[punkt.status];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const statusBreite = doc.getTextWidth(statusTextWert) + 6;
    const statusX = RAND + INHALT_BREITE - statusBreite - 5;
    doc.setFillColor(...farben.bg);
    doc.roundedRect(statusX, innenY - 4, statusBreite, 5.5, 1.5, 1.5, 'F');
    doc.setTextColor(...farben.text);
    doc.text(statusTextWert, statusX + 3, innenY - 0.3);

    innenY = blockStartY + kopfOffset;

    if (anmerkungZeilen.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(26, 29, 33);
      doc.text(anmerkungZeilen, innenX, innenY);
      innenY += anmerkungHoehe;
    }

    if (fotos.length > 0) {
      innenY += 3;
      const slotAnzahl = 3;
      const luecke = 4;
      const slotBreite = (INHALT_BREITE - 10 - luecke * (slotAnzahl - 1)) / slotAnzahl;

      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        try {
          const bildBlob = foto.pfeil ? await pfeilInBildRendern(foto.blob, foto.pfeil) : await blobSicherLesen(foto.blob);
          const dataUrl = await blobZuDataUrl(bildBlob);
          const skalierung = Math.min(slotBreite / foto.breite, FOTO_MAX_HOEHE / foto.hoehe, 1);
          const breite = foto.breite * skalierung;
          const hoehe = foto.hoehe * skalierung;
          const slotX = innenX + i * (slotBreite + luecke);
          const bildX = slotX + (slotBreite - breite) / 2;
          doc.addImage(dataUrl, 'JPEG', bildX, innenY, breite, hoehe);
        } catch {
          // Foto konnte nicht gelesen werden (z. B. von iOS verworfene Blob-Ablagedatei) –
          // dieses eine Foto überspringen, statt den ganzen Export abzubrechen.
        }
      }
    }

    y = blockStartY + blockHoehe;
  }

  const gruppen = new Map<string, Punkt[]>();
  for (const p of nichtGeloeschte) {
    const liste = gruppen.get(p.anlageNr) ?? [];
    liste.push(p);
    gruppen.set(p.anlageNr, liste);
  }
  const anlagenListe = Array.from(gruppen.entries()).sort((a, b) => naturalCompare(a[0], b[0]));

  for (const [anlageNr, anlagenPunkte] of anlagenListe) {
    platzPruefen(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 56, 104);
    doc.text(`${t.anlage} ${anlageNr}`, RAND, y);
    y += 8;

    const sortiert = [...anlagenPunkte].sort((a, b) => a.nr - b.nr);
    for (const punkt of sortiert) {
      await punktBlockZeichnen(punkt);
    }
    y += 3;
  }

  if (geloeschtePunkte.length > 0) {
    platzPruefen(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 56, 104);
    doc.text(t.geloeschtePunkte, RAND, y);
    y += 8;

    const geloeschtSortiert = [...geloeschtePunkte].sort(
      (a, b) => naturalCompare(a.anlageNr, b.anlageNr) || a.nr - b.nr,
    );
    for (const punkt of geloeschtSortiert) {
      const info = punkt.geloescht;
      if (!info) continue;
      const zeileText = `#${punkt.nr} · ${t.anlage} ${punkt.anlageNr} · ${t.geloeschtAmDurch(isoDatumDeutsch(info.am), info.durch)}${info.grund ? ` – ${info.grund}` : ''}`;
      const zeilen: string[] = doc.splitTextToSize(zeileText, INHALT_BREITE);
      platzPruefen(zeilen.length * 5 + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(26, 29, 33);
      doc.text(zeilen, RAND, y);
      y += zeilen.length * 5 + 2;
    }
  }

  const seitenAnzahl = doc.getNumberOfPages();
  for (let i = 1; i <= seitenAnzahl; i++) {
    doc.setPage(i);
    doc.setDrawColor(223, 228, 234);
    doc.setLineWidth(0.3);
    doc.line(RAND, fussOben, SEITE_BREITE - RAND, fussOben);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(92, 102, 114);
    doc.text(t.seite(i, seitenAnzahl), RAND, fussOben + 5);
    doc.text(`${bericht.ersteller} · ${formatDeutsch(bericht.datum)}`, SEITE_BREITE - RAND, fussOben + 5, {
      align: 'right',
    });
  }

  const arrayBuffer = doc.output('arraybuffer');
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}
