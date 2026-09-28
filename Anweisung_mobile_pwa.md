# CLAUDE.md – Punkterfassung an Bord (LETHE)

## 1. Zweck

Mobile Web-App (PWA) zur Erfassung von Arbeitspunkten an Türanlagen an Bord von Yachten.
Pro Einsatz entsteht **ein Bericht**, darin beliebig viele **Punkte**, je Punkt eine Anlagen-Nr.,
eine Lage (Ziffernblatt), eine Baugruppe, ein Status, eine Anmerkung und bis zu 3 Fotos.
Ergebnis: **Excel-Liste + PDF-Bericht**, zusätzlich ZIP-Backup.

- Einzelnutzer, primäres Gerät: **iPhone (Safari, als PWA auf dem Home-Bildschirm installiert)**
- Kein Backend, keine Cloud. Alle Daten liegen lokal im Gerät (IndexedDB).
- Netz ist meist vorhanden, die App muss trotzdem vollständig offline funktionieren.
- UI-Sprache und Berichtssprache: **Deutsch**. Alle Texte zentral ablegen (Englisch folgt später).

## 2. Arbeitsweise für Claude Code

- Umsetzung strikt in den Phasen aus Abschnitt 9. Jede Phase endet mit einem lauffähigen,
  auf GitHub Pages deployten Stand, der auf dem iPhone getestet wird.
- Keine Funktionen über den Phasenumfang hinaus ergänzen. Bei Unklarheit oder nötiger
  Abweichung vom Konzept: **vorher fragen**.
- Ein Commit pro abgeschlossenem Arbeitsschritt, aussagekräftige Commit-Messages (Deutsch).
- Nach jeder Phase die Checkliste „Abnahme“ der Phase abarbeiten und Ergebnis melden.
- Mobile first: Bedienung mit einer Hand, große Touch-Ziele (min. 44 × 44 px).

## 3. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Build | Vite + TypeScript | schnell, einfache Konfiguration |
| UI | Svelte 5 | wenig Boilerplate, kleine Bundles |
| Datenhaltung | Dexie.js (IndexedDB) | Blobs/Fotos lokal speicherbar, localStorage zu klein |
| PWA | vite-plugin-pwa | Service Worker, Manifest, Offline-Cache |
| Excel | ExcelJS | Bilder einbetten, Datenvalidierung (Dropdown) |
| PDF | jsPDF | clientseitig, Bilder und Vektorgrafik |
| Backup | JSZip | ZIP mit JSON + Fotos |
| Hosting | GitHub Pages über GitHub Actions | kostenlos, **öffentliches Repo** (enthält keine Daten) |

- `base` in `vite.config.ts` auf den Repo-Namen setzen (GitHub-Pages-Unterpfad).
- Keine weiteren Laufzeit-Abhängigkeiten ohne Rückfrage.

## 4. Datenmodell

```ts
type Lage = 1|2|3|4|5|6|7|8|9|10|11|12|'M';   // 'M' = generell, gilt für die ganze Anlage
type PunktStatus = 'offen' | 'in_bearbeitung' | 'erledigt';
type BerichtStatus = 'offen' | 'abgeschlossen';

interface Einstellungen {
  ersteller: string;                 // einmalig gepflegt, Vorgabe für neue Berichte
  baugruppen: Baugruppe[];           // global für alle Berichte
}

interface Baugruppe {
  id: string;                        // uuid
  name: string;                      // z. B. "ANTRIEB"
  aktiv: boolean;                    // inaktiv = für neue Punkte nicht wählbar
  sortierung: number;
}
// Standardwerte: ANTRIEB, ZARGE, BLATT, BODENF., SONSTIGES

interface Bericht {
  id: string;
  projektNr: string;                 // Pflicht
  projektName: string;               // Pflicht
  vorgang: string;                   // Pflicht
  beschreibung: string;              // Pflicht
  ersteller: string;                 // Pflicht, Vorgabe aus Einstellungen
  datum: string;                     // Pflicht, ISO-Datum, automatisch = heute, änderbar
  neubauNr?: string;                 // optional
  neubauName?: string;               // optional
  ort?: string;                      // optional (Werft/Liegeplatz)
  status: BerichtStatus;
  naechstePunktNr: number;           // Zähler, wird nie zurückgesetzt/verringert
  erstelltAm: string;
  geaendertAm: string;
}

interface Punkt {
  id: string;
  berichtId: string;
  nr: number;                        // laufend je Bericht, lückenhaft zulässig
  anlageNr: string;                  // Pflicht; Anlage ist ein FELD, keine eigene Ebene
  lage: Lage;                        // Pflicht
  baugruppeId: string;               // Pflicht
  baugruppeName: string;             // Snapshot zum Erfassungszeitpunkt
  status: PunktStatus;               // neu = 'offen'
  erledigtAm?: string;               // automatisch gesetzt beim Wechsel auf 'erledigt',
                                     // entfernt beim Wechsel zurück
  anmerkung?: string;
  geloescht?: { am: string; durch: string; grund?: string };   // Soft-Delete
  erstelltAm: string;
  geaendertAm: string;
}

interface Foto {
  id: string;
  punktId: string;
  reihenfolge: 1 | 2 | 3;            // max. 3 Fotos je Punkt
  blob: Blob;                        // komprimiertes JPEG, Original ohne Pfeil
  breite: number;
  hoehe: number;
  pfeil?: { x1: number; y1: number; x2: number; y2: number };  // normiert 0..1, Spitze = x2/y2
  erstelltAm: string;
}
```

### Regeln

- **Punktnummer:** `nr = bericht.naechstePunktNr`, danach Zähler +1. Nie neu nummerieren.
- **Löschen von Punkten = Soft-Delete:** `geloescht` setzen (`durch` = Ersteller aus
  Einstellungen, `grund` optional abfragen). Punkt bleibt gelistet, ausgegraut und
  durchgestrichen, und ist wiederherstellbar (Feld `geloescht` entfernen).
- **Baugruppen:** Entfernen = `aktiv: false`. Bestehende Punkte behalten `baugruppeName`.
- **Berichte löschen** (hart) nur nach Bestätigung und mit Hinweis auf ZIP-Backup.
- Gruppierung/Sortierung überall: `anlageNr` (natürliche Sortierung), dann `nr`.

## 5. Screens und Ablauf

1. **Berichtsliste** – Karten mit Projekt-Nr., Projektname, Vorgang, Datum, Anzahl Punkte
   je Status. Aktionen: Neuer Bericht, Öffnen, Einstellungen, ZIP-Import.
2. **Bericht anlegen/bearbeiten** – Pflichtfelder validieren, Speichern erst bei Vollständigkeit.
3. **Bericht-Übersicht** – Punkte gruppiert nach Anlage, je Zeile: Nr., Lage-Symbol, BG,
   Status-Farbe, Foto-Anzahl. Filter: alle / offen / in Bearbeitung / erledigt / gelöschte.
   Aktionen: Neuer Punkt, Export, Bericht abschließen.
4. **Punkt erfassen/bearbeiten** – Reihenfolge der Felder:
   1. Anlagen-Nr. (vorausgefüllt mit der des vorigen Punkts)
   2. Lage über das **Ziffernblatt** (siehe unten)
   3. BG als Dropdown (nur aktive, **keine Vorauswahl**)
   4. Fotos (0–3) mit Pfeil-Funktion
   5. Anmerkung (mehrzeilig)
   6. Status (neu: offen)
   Buttons unten fixiert: **„Speichern & nächster Punkt“** (übernimmt Anlagen-Nr.) und
   **„Neue Anlage“** (speichert, leert Anlagen-Nr. und fokussiert das Feld).
5. **Einstellungen** – Ersteller, Baugruppen pflegen (hinzufügen, umbenennen, sortieren,
   deaktivieren), Speicherstatus anzeigen (`navigator.storage.estimate()`, `persisted()`).

### Ziffernblatt

- SVG-Kreis mit 12 antippbaren Sektoren und einem Mittelfeld „M“.
- Fest angezeigter Hinweis: **„Ansicht von außen nach innen“**.
- „M“ bedeutet **generell** (gilt für die Anlage allgemein).
- Anzeige des Werts im Text: „3 Uhr“ bzw. „generell“.
- Kleines Ziffernblatt-Symbol mit markierter Position für Listen und Bericht
  (wiederverwendbare Komponente, auch als Grafik für PDF erzeugbar).

### Fotos und Pfeil

- Aufnahme über `<input type="file" accept="image/*" capture="environment">`.
- Sofort komprimieren: lange Kante max. 1600 px, JPEG-Qualität 0,8.
  Ausrichtung über `createImageBitmap(file, { imageOrientation: 'from-image' })`.
- **Pfeil:** Foto antippen öffnet Vollbild. Finger aufsetzen = Pfeilanfang, ziehen,
  loslassen = Spitze. Ein Pfeil pro Foto, erneutes Zeichnen ersetzt ihn. Button „Pfeil entfernen“.
  Darstellung: Rot (#E30613) mit weißer Kontur, Strichstärke relativ zur Bildgröße.
- Der Pfeil wird nur als Koordinaten gespeichert und **erst beim Export** ins Bild gerendert.
- Fotos löschen und neu aufnehmen möglich. Bei 3 Fotos ist der Aufnahme-Button deaktiviert.

## 6. Export

Dateinamen: `{projektNr}_{vorgang}_Punkte_{JJJJ-MM-TT}.xlsx|.pdf|.zip`
Vor dem Export Auswahl: **alle Punkte** oder **nur offen + in Bearbeitung**.
Bereitstellung über `navigator.share({ files })` (iOS-Teilen-Menü), sonst Download.

### Excel (ExcelJS)

- Kopfbereich: Projekt-Nr., Projektname, Vorgang, Beschreibung, Neubau-Nr./-Name, Ort,
  Ersteller, Datum.
- Tabelle, eine Zeile je Punkt: Anlage | Pkt.-Nr. | Lage | BG | Status | Anmerkung |
  Foto 1 | Foto 2 | Foto 3 | erfasst am | erledigt am | gelöscht am/durch/Grund
- **Status-Spalte mit Datenvalidierung (Dropdown):** offen, in Bearbeitung, erledigt, gelöscht.
- Statusfarben als Zellhintergrund: offen rot, in Bearbeitung gelb, erledigt grün, gelöscht grau.
- Fotos als Vorschaubilder (mit eingezeichnetem Pfeil) in den Zellen, Zeilenhöhe passend.
- Datumsformat deutsch (TT.MM.JJJJ), Autofilter und fixierte Kopfzeile.

### PDF (jsPDF, A4 hoch)

- Kopf jeder Seite: LETHE-Logo (`public/assets/lethe-logo.jpg`), Projekt-Nr. · Vorgang.
- Deckblock Seite 1: alle Berichtsdaten und eine Zusammenfassung (Anzahl je Status).
- Je Anlage ein Abschnitt „Anlage {Nr}“, darin je Punkt ein Block:
  Nr., Lage-Symbol + Text, BG, Status (farbige Markierung), Anmerkung,
  bis zu 3 Fotos nebeneinander (mit Pfeil). Blöcke nicht über Seitenumbrüche teilen.
- Gelöschte Punkte nur als **Kurzliste am Ende** (Nr., Anlage, gelöscht am/durch, Grund), ohne Fotos.
- Fußzeile: „Seite x von y“, Ersteller, Datum.

### ZIP-Backup und Import

- Inhalt: `bericht.json` (Bericht + Punkte + Foto-Metadaten, Versionsfeld `schemaVersion`)
  und `fotos/{fotoId}.jpg` (Originale ohne Pfeil).
- Import legt den Bericht an. Existiert die `id` bereits: Rückfrage (ersetzen / als Kopie).

## 7. Datensicherheit auf dem iPhone

- Beim ersten Start `navigator.storage.persist()` anfordern und Ergebnis in den Einstellungen anzeigen.
- Hinweis in der App: Die Daten liegen nur auf diesem Gerät. Wird das App-Symbol oder
  werden die Website-Daten gelöscht, sind sie verloren.
- Bei offenen Berichten, die seit mehr als 7 Tagen nicht gesichert wurden, einen
  dezenten Hinweis „ZIP-Backup erstellen“ anzeigen (Zeitpunkt des letzten Backups je Bericht speichern).

## 8. Projektstruktur (Vorschlag)

```
src/
  lib/
    db.ts              # Dexie-Schema, Migrationen
    model.ts           # Typen aus Abschnitt 4
    texte/de.ts        # alle UI- und Berichtstexte
    foto.ts            # Komprimierung, Pfeil-Rendering (Canvas)
    export/excel.ts
    export/pdf.ts
    export/zip.ts
  components/
    Ziffernblatt.svelte
    FotoPfeil.svelte
    ...
  routes/ bzw. views/
public/
  assets/lethe-logo.jpg
.github/workflows/deploy.yml
```

## 9. Phasen

**Phase 1 – Grundgerüst & Deployment**
Vite/Svelte/TS, PWA-Manifest (Name „Punkterfassung“, Icons), Service Worker, GitHub-Actions-Deploy.
*Abnahme:* URL auf dem iPhone öffnen, zum Home-Bildschirm hinzufügen, im Flugmodus starten.

**Phase 2 – Datenmodell & Berichte**
Dexie-Schema, Einstellungen (Ersteller, Baugruppen mit Standardwerten), Berichtsliste, Bericht anlegen/bearbeiten.
*Abnahme:* Bericht anlegen, App schließen, neu öffnen, Daten vorhanden.

**Phase 3 – Punkterfassung**
Punkt-Maske mit Ziffernblatt, BG-Dropdown, Status, Anmerkung, Nummernvergabe, Schnellerfassung, Soft-Delete/Wiederherstellen, Bericht-Übersicht mit Filtern.
*Abnahme:* 10 Punkte über 3 Anlagen erfassen, einen löschen, Nummer bleibt als Lücke, Wiederherstellung funktioniert.

**Phase 4 – Fotos & Pfeil**
Kamera, Komprimierung, max. 3, Pfeil zeichnen/ersetzen/entfernen.
*Abnahme:* Hochformat- und Querformatfotos richtig ausgerichtet, Pfeil sitzt nach Neustart an derselben Stelle.

**Phase 5 – Excel-Export**
*Abnahme:* Datei über Teilen-Menü in iCloud Drive sichern, in Excel öffnen: Bilder mit Pfeil sichtbar, Status-Dropdown funktioniert.

**Phase 6 – PDF-Export**
*Abnahme:* Logo, Gruppierung nach Anlagen, keine zerteilten Punkt-Blöcke, gelöschte Punkte nur als Kurzliste am Ende.

**Phase 7 – ZIP-Backup/-Import & Datensicherheit**
*Abnahme:* Bericht exportieren, löschen, per Import vollständig wiederherstellen (inkl. Fotos und Pfeile).

## 10. Später (nicht umsetzen ohne Auftrag)

- Berichtssprache Englisch (Umschalter, Texte aus `texte/en.ts`)
- Mehrere Geräte / Synchronisation
- Weitere Markierungen auf Fotos (Kreis, Text)
