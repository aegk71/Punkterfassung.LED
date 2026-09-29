import type { BerichtSprache, Lage } from '../model';

interface Berichtstexte {
  titel: string;
  projektNr: string;
  projektName: string;
  vorgang: string;
  beschreibung: string;
  neubauNr: string;
  neubauName: string;
  ort: string;
  ersteller: string;
  datum: string;
  zusammenfassung: string;
  status: { offen: string; in_bearbeitung: string; erledigt: string; geloescht: string };
  statusListe: string;
  anlage: string;
  geloeschtePunkte: string;
  geloeschtAmDurch: (datum: string, durch: string) => string;
  seite: (nr: number, gesamt: number) => string;
  pktNr: string;
  lage: string;
  baugruppe: string;
  anmerkung: string;
  foto: (nr: number) => string;
  erfasstAm: string;
  erledigtAm: string;
  geloescht: string;
  lageUhr: (nr: number) => string;
  lageGenerell: string;
}

const de: Berichtstexte = {
  titel: 'Punkterfassung – Bericht',
  projektNr: 'Projekt-Nr.',
  projektName: 'Projektname',
  vorgang: 'Vorgang',
  beschreibung: 'Beschreibung',
  neubauNr: 'Neubau-Nr.',
  neubauName: 'Neubau-Name',
  ort: 'Ort',
  ersteller: 'Ersteller',
  datum: 'Datum',
  zusammenfassung: 'Zusammenfassung',
  status: { offen: 'offen', in_bearbeitung: 'in Bearbeitung', erledigt: 'erledigt', geloescht: 'gelöscht' },
  statusListe: 'offen,in Bearbeitung,erledigt,gelöscht',
  anlage: 'Anlage',
  geloeschtePunkte: 'Gelöschte Punkte',
  geloeschtAmDurch: (datum, durch) => `gelöscht am ${datum} durch ${durch}`,
  seite: (nr, gesamt) => `Seite ${nr} von ${gesamt}`,
  pktNr: 'Pkt.-Nr.',
  lage: 'Lage',
  baugruppe: 'BG',
  anmerkung: 'Anmerkung',
  foto: (nr) => `Foto ${nr}`,
  erfasstAm: 'erfasst am',
  erledigtAm: 'erledigt am',
  geloescht: 'Gelöscht',
  lageUhr: (nr) => `${nr} Uhr`,
  lageGenerell: 'generell',
};

const en: Berichtstexte = {
  titel: 'Point Inspection Report',
  projektNr: 'Project No.',
  projektName: 'Project Name',
  vorgang: 'Job',
  beschreibung: 'Description',
  neubauNr: 'New-Build No.',
  neubauName: 'New-Build Name',
  ort: 'Location',
  ersteller: 'Created By',
  datum: 'Date',
  zusammenfassung: 'Summary',
  status: { offen: 'open', in_bearbeitung: 'in progress', erledigt: 'completed', geloescht: 'deleted' },
  statusListe: 'open,in progress,completed,deleted',
  anlage: 'Unit',
  geloeschtePunkte: 'Deleted Points',
  geloeschtAmDurch: (datum, durch) => `deleted on ${datum} by ${durch}`,
  seite: (nr, gesamt) => `Page ${nr} of ${gesamt}`,
  pktNr: 'Pt. No.',
  lage: 'Position',
  baugruppe: 'Comp.',
  anmerkung: 'Note',
  foto: (nr) => `Photo ${nr}`,
  erfasstAm: 'logged on',
  erledigtAm: 'completed on',
  geloescht: 'Deleted',
  lageUhr: (nr) => `${nr} o'clock`,
  lageGenerell: 'general',
};

export function berichtTexte(sprache: BerichtSprache | undefined): Berichtstexte {
  return sprache === 'en' ? en : de;
}

export function lageTextExport(lage: Lage, sprache: BerichtSprache | undefined): string {
  const t = berichtTexte(sprache);
  return lage === 'M' ? t.lageGenerell : t.lageUhr(lage);
}
