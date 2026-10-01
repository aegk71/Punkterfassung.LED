<script lang="ts">
  import { db, punktWiederherstellen, berichtHartLoeschen } from '../lib/db';
  import type { Bericht, Foto, Punkt } from '../lib/model';
  import { texte } from '../lib/texte/de';
  import { naturalCompare } from '../lib/naturalSort';
  import { heuteIso, formatDeutsch } from '../lib/datum';
  import { exportDateiname } from '../lib/export/dateiname';
  import { dateiBereitstellen } from '../lib/export/teilen';
  import ZiffernblattSymbol from '../components/ZiffernblattSymbol.svelte';

  let { berichtId, onZurueck, onBearbeiten, onNeuerPunkt, onPunktOeffnen }: {
    berichtId: string;
    onZurueck: () => void;
    onBearbeiten: (berichtId: string) => void;
    onNeuerPunkt: (berichtId: string) => void;
    onPunktOeffnen: (berichtId: string, punktId: string, punktIds: string[]) => void;
  } = $props();

  type Filter = 'alle' | 'offen' | 'in_bearbeitung' | 'erledigt' | 'geloescht';

  let bericht = $state<Bericht | null>(null);
  let punkte = $state<Punkt[]>([]);
  let fotosProPunkt = $state<Record<string, number>>({});
  let alleFotosProPunkt = new Map<string, Foto[]>();
  let filter = $state<Filter>('alle');
  let geladen = $state(false);

  async function laden() {
    const [b, alleP, alleF] = await Promise.all([
      db.berichte.get(berichtId),
      db.punkte.where('berichtId').equals(berichtId).toArray(),
      db.fotos.toArray(),
    ]);
    bericht = b ?? null;
    punkte = alleP;

    const zaehler: Record<string, number> = {};
    const gruppiert = new Map<string, Foto[]>();
    for (const f of alleF) {
      zaehler[f.punktId] = (zaehler[f.punktId] ?? 0) + 1;
      const liste = gruppiert.get(f.punktId) ?? [];
      liste.push(f);
      gruppiert.set(f.punktId, liste);
    }
    fotosProPunkt = zaehler;
    alleFotosProPunkt = gruppiert;

    geladen = true;
  }

  laden();

  let sichtbarePunkte = $derived(
    filter === 'geloescht'
      ? punkte.filter((p) => p.geloescht)
      : filter === 'alle'
        ? punkte
        : punkte.filter((p) => !p.geloescht && p.status === filter),
  );

  let gruppen = $derived.by(() => {
    const map = new Map<string, Punkt[]>();
    for (const p of sichtbarePunkte) {
      const liste = map.get(p.anlageNr) ?? [];
      liste.push(p);
      map.set(p.anlageNr, liste);
    }
    const ergebnis = Array.from(map.entries()).map(([anlageNr, liste]) => ({
      anlageNr,
      punkte: [...liste].sort((a, b) => a.nr - b.nr),
    }));
    ergebnis.sort((a, b) => naturalCompare(a.anlageNr, b.anlageNr));
    return ergebnis;
  });

  let punktIdsGeordnet = $derived(gruppen.flatMap((g) => g.punkte.filter((p) => !p.geloescht).map((p) => p.id)));

  let eingeklappt = $state<Set<string>>(new Set());

  function anlageUmschalten(anlageNr: string) {
    const neu = new Set(eingeklappt);
    if (neu.has(anlageNr)) neu.delete(anlageNr);
    else neu.add(anlageNr);
    eingeklappt = neu;
  }

  async function statusUmschalten() {
    if (!bericht) return;
    const neuerStatus = bericht.status === 'offen' ? 'abgeschlossen' : 'offen';
    const geaendertAm = new Date().toISOString();
    await db.berichte.put({ ...$state.snapshot(bericht), status: neuerStatus, geaendertAm });
    bericht.status = neuerStatus;
    bericht.geaendertAm = geaendertAm;
  }

  async function wiederherstellen(punktId: string) {
    await punktWiederherstellen(punktId);
    await laden();
  }

  let loeschenBestaetigenSichtbar = $state(false);
  let loeschenLaeuft = $state(false);

  async function berichtLoeschenBestaetigt() {
    loeschenLaeuft = true;
    try {
      await berichtHartLoeschen(berichtId);
      onZurueck();
    } finally {
      loeschenLaeuft = false;
    }
  }

  function statusText(punkt: Punkt): string {
    if (punkt.geloescht) return texte.status.geloescht;
    return texte.status[punkt.status];
  }

  type ExportAuswahl = 'alle' | 'offen_bearbeitung';
  let exportSichtbar = $state(false);
  let exportAuswahl = $state<ExportAuswahl>('alle');
  let exportLaeuft = $state(false);
  let exportFehler = $state('');

  let pdfVorschauSeiten = $state<string[]>([]);
  let pdfVorschauSeitenAnzahl = $state(0);
  let pdfVorschauDateiname = $state('');
  let pdfVorschauBlob: Blob | null = null;
  let pdfTeilenLaeuft = $state(false);

  function pdfVorschauSchliessen() {
    pdfVorschauSeiten = [];
    pdfVorschauSeitenAnzahl = 0;
    pdfVorschauDateiname = '';
    pdfVorschauBlob = null;
  }

  async function pdfVorschauTeilen() {
    if (!pdfVorschauBlob) return;
    pdfTeilenLaeuft = true;
    try {
      await dateiBereitstellen(pdfVorschauBlob, pdfVorschauDateiname, 'application/pdf');
    } finally {
      pdfTeilenLaeuft = false;
    }
  }

  function exportStarten() {
    exportSichtbar = true;
    exportFehler = '';
  }

  function exportAbbrechen() {
    exportSichtbar = false;
  }

  async function exportAusfuehren(format: 'excel' | 'pdf' | 'zip') {
    if (!bericht) return;
    exportLaeuft = true;
    exportFehler = '';
    try {
      const punkteFuerExport =
        exportAuswahl === 'alle'
          ? punkte
          : punkte.filter((p) => !p.geloescht && (p.status === 'offen' || p.status === 'in_bearbeitung'));

      if (format === 'excel') {
        const { berichtAlsExcel } = await import('../lib/export/excel');
        const blob = await berichtAlsExcel(bericht, punkteFuerExport, alleFotosProPunkt);
        const dateiname = exportDateiname(bericht.projektNr, bericht.vorgang, heuteIso(), 'xlsx');
        await dateiBereitstellen(
          blob,
          dateiname,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        exportSichtbar = false;
      } else if (format === 'pdf') {
        const { berichtAlsPdf } = await import('../lib/export/pdf');
        const blob = await berichtAlsPdf(bericht, punkteFuerExport, alleFotosProPunkt);
        pdfVorschauDateiname = exportDateiname(bericht.projektNr, bericht.vorgang, heuteIso(), 'pdf');
        pdfVorschauBlob = blob;
        pdfVorschauSeiten = [];
        pdfVorschauSeitenAnzahl = 0;

        const { pdfSeitenRendern } = await import('../lib/export/pdfVorschau');
        await pdfSeitenRendern(blob, (bildDataUrl, seitenNr, seitenAnzahl) => {
          pdfVorschauSeiten = [...pdfVorschauSeiten, bildDataUrl];
          pdfVorschauSeitenAnzahl = seitenAnzahl;
          if (seitenNr === 1) exportSichtbar = false;
        });
      } else {
        const alleFotos = Array.from(alleFotosProPunkt.values()).flat();
        const { berichtAlsZip } = await import('../lib/export/zip');
        const blob = await berichtAlsZip($state.snapshot(bericht), $state.snapshot(punkte), $state.snapshot(alleFotos));
        const dateiname = exportDateiname(bericht.projektNr, bericht.vorgang, heuteIso(), 'zip');
        await dateiBereitstellen(blob, dateiname, 'application/zip');

        const jetzt = new Date().toISOString();
        const berichtZumSpeichern = { ...$state.snapshot(bericht), letzteSicherung: jetzt };
        await db.berichte.put(berichtZumSpeichern);
        bericht.letzteSicherung = jetzt;
        exportSichtbar = false;
      }
    } catch (err) {
      exportFehler = err instanceof Error ? err.message : 'Export fehlgeschlagen.';
    } finally {
      exportLaeuft = false;
    }
  }
</script>

<div class="page">
  <header class="page-head">
    <button class="btn btn-secondary" onclick={onZurueck}>{texte.berichtUebersicht.zurueck}</button>
    {#if bericht}
      <div class="titel-block">
        <h1>{bericht.titel || `${bericht.projektNr} · ${bericht.projektName} · ${bericht.vorgang}`}</h1>
        {#if bericht.titel}
          <p class="bericht-kontext">{bericht.projektNr} · {bericht.projektName} · {bericht.vorgang}</p>
        {/if}
      </div>
    {/if}
  </header>

  {#if geladen && bericht}
    <div class="unterzeile">
      <button class="btn btn-secondary btn-klein" onclick={() => onBearbeiten(berichtId)}>
        {texte.berichtUebersicht.bearbeiten}
      </button>
      <button class="btn btn-secondary btn-klein" onclick={statusUmschalten}>
        {bericht.status === 'offen' ? texte.berichtUebersicht.abschliessen : texte.berichtUebersicht.wiederEroeffnen}
      </button>
      <button class="btn btn-secondary btn-klein" onclick={exportStarten}>
        {texte.berichtUebersicht.export}
      </button>
      <button class="btn btn-secondary btn-klein loeschen-btn" onclick={() => (loeschenBestaetigenSichtbar = true)}>
        {texte.berichtUebersicht.loeschen}
      </button>
    </div>

    {#if loeschenBestaetigenSichtbar}
      <div class="card loeschen-block">
        <p class="loeschen-titel">{texte.berichtUebersicht.loeschenBestaetigenTitel}</p>
        <p>{texte.berichtUebersicht.loeschenBestaetigenText}</p>
        <p class="backup-hinweis">
          {bericht.letzteSicherung
            ? texte.berichtUebersicht.loeschenLetztesBackup(formatDeutsch(bericht.letzteSicherung.slice(0, 10)))
            : texte.berichtUebersicht.loeschenKeinBackup}
        </p>
        <div class="loeschen-aktionen">
          <button
            class="btn btn-secondary"
            onclick={() => (loeschenBestaetigenSichtbar = false)}
            disabled={loeschenLaeuft}
          >
            {texte.berichtForm.abbrechen}
          </button>
          <button class="btn loeschen-bestaetigen-btn" onclick={berichtLoeschenBestaetigt} disabled={loeschenLaeuft}>
            {texte.berichtUebersicht.loeschenBestaetigen}
          </button>
        </div>
      </div>
    {/if}

    {#if exportSichtbar}
      <div class="card export-block">
        <p class="export-frage">{texte.berichtUebersicht.exportAuswahlFrage}</p>
        <label class="export-option">
          <input type="radio" name="export-auswahl" value="alle" bind:group={exportAuswahl} />
          {texte.berichtUebersicht.exportAlle}
        </label>
        <label class="export-option">
          <input type="radio" name="export-auswahl" value="offen_bearbeitung" bind:group={exportAuswahl} />
          {texte.berichtUebersicht.exportOffenBearbeitung}
        </label>
        {#if exportFehler}
          <p class="fehler">{exportFehler}</p>
        {/if}
        <div class="export-aktionen">
          <button class="btn btn-secondary" onclick={exportAbbrechen} disabled={exportLaeuft}>
            {texte.berichtForm.abbrechen}
          </button>
          <button class="btn btn-primary" onclick={() => exportAusfuehren('excel')} disabled={exportLaeuft}>
            {exportLaeuft ? texte.berichtUebersicht.exportLaeuft : texte.berichtUebersicht.exportExcel}
          </button>
          <button class="btn btn-primary" onclick={() => exportAusfuehren('pdf')} disabled={exportLaeuft}>
            {exportLaeuft ? texte.berichtUebersicht.exportLaeuft : texte.berichtUebersicht.exportPdf}
          </button>
        </div>
        <div class="export-aktionen">
          <button class="btn btn-secondary zip-btn" onclick={() => exportAusfuehren('zip')} disabled={exportLaeuft}>
            {exportLaeuft ? texte.berichtUebersicht.exportLaeuft : texte.berichtUebersicht.exportZip}
          </button>
        </div>
        <p class="export-zip-hinweis">{texte.berichtUebersicht.exportZipHinweis}</p>
      </div>
    {/if}

    <div class="filter-leiste">
      <button class="filter-btn" class:aktiv={filter === 'alle'} onclick={() => (filter = 'alle')}>
        {texte.berichtUebersicht.filterAlle}
      </button>
      <button class="filter-btn" class:aktiv={filter === 'offen'} onclick={() => (filter = 'offen')}>
        {texte.berichtUebersicht.filterOffen}
      </button>
      <button class="filter-btn" class:aktiv={filter === 'in_bearbeitung'} onclick={() => (filter = 'in_bearbeitung')}>
        {texte.berichtUebersicht.filterInBearbeitung}
      </button>
      <button class="filter-btn" class:aktiv={filter === 'erledigt'} onclick={() => (filter = 'erledigt')}>
        {texte.berichtUebersicht.filterErledigt}
      </button>
      <button class="filter-btn" class:aktiv={filter === 'geloescht'} onclick={() => (filter = 'geloescht')}>
        {texte.berichtUebersicht.filterGeloescht}
      </button>
    </div>

    {#if gruppen.length === 0}
      <p class="hinweis">{texte.berichtUebersicht.keinePunkte}</p>
    {:else}
      {#each gruppen as gruppe (gruppe.anlageNr)}
        <section class="anlage-gruppe">
          <button
            class="section-label anlage-kopf"
            onclick={() => anlageUmschalten(gruppe.anlageNr)}
            aria-expanded={!eingeklappt.has(gruppe.anlageNr)}
          >
            <span class="anlage-chevron">{eingeklappt.has(gruppe.anlageNr) ? '▸' : '▾'}</span>
            <span>Anlage {gruppe.anlageNr}</span>
            <span class="anlage-anzahl">({gruppe.punkte.length})</span>
          </button>
          {#if !eingeklappt.has(gruppe.anlageNr)}
            <ul class="punkte-liste">
              {#each gruppe.punkte as punkt (punkt.id)}
                <li class="card punkt-zeile" class:geloescht={!!punkt.geloescht}>
                  <button
                    class="punkt-inhalt"
                    disabled={!!punkt.geloescht}
                    onclick={() => onPunktOeffnen(berichtId, punkt.id, punktIdsGeordnet)}
                  >
                    <span class="punkt-nr">#{punkt.nr}</span>
                    <ZiffernblattSymbol lage={punkt.lage} groesse={22} />
                    <span class="punkt-bg">{punkt.baugruppeName}</span>
                    <span class="badge badge-{punkt.geloescht ? 'geloescht' : punkt.status}">{statusText(punkt)}</span>
                    <span class="punkt-fotos">{fotosProPunkt[punkt.id] ?? 0} {texte.berichtUebersicht.fotos}</span>
                  </button>
                  {#if punkt.geloescht}
                    <button class="btn btn-secondary btn-klein wiederherstellen-btn" onclick={() => wiederherstellen(punkt.id)}>
                      {texte.berichtUebersicht.wiederherstellen}
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/each}
    {/if}
  {/if}

  <button class="btn btn-primary fab" onclick={() => onNeuerPunkt(berichtId)}>
    {texte.berichtUebersicht.neuerPunkt}
  </button>

  {#if pdfVorschauSeiten.length > 0}
    <div class="pdf-vorschau-overlay">
      <div class="pdf-vorschau-kopf">
        <span class="pdf-vorschau-titel">{texte.berichtUebersicht.pdfVorschauTitel}</span>
        <button class="btn btn-secondary btn-klein" onclick={pdfVorschauSchliessen}>
          {texte.berichtUebersicht.pdfSchliessen}
        </button>
      </div>
      <div class="pdf-vorschau-frame">
        {#each pdfVorschauSeiten as seite, i (i)}
          <img class="pdf-seite" src={seite} alt={`Seite ${i + 1}`} />
        {/each}
        {#if pdfVorschauSeiten.length < pdfVorschauSeitenAnzahl}
          <p class="pdf-laedt-hinweis">{texte.berichtUebersicht.pdfSeitenLaden}</p>
        {/if}
      </div>
      <div class="pdf-vorschau-fuss">
        <button class="btn btn-primary" onclick={pdfVorschauTeilen} disabled={pdfTeilenLaeuft}>
          {texte.berichtUebersicht.pdfTeilen}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px 16px 100px;
  }

  .page-head {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .titel-block {
    flex: 1 1 auto;
    min-width: 0;
  }

  .page-head h1 {
    font-size: 18px;
    overflow-wrap: break-word;
  }

  .bericht-kontext {
    font-size: 13px;
    color: var(--muted);
    margin-top: 2px;
    overflow-wrap: break-word;
  }

  .unterzeile {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .export-block {
    display: grid;
    gap: 12px;
    margin-bottom: 20px;
  }

  .export-frage {
    font-weight: 700;
    margin: 0;
  }

  .export-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 400;
    color: var(--ink);
  }

  .export-aktionen {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .export-aktionen .btn {
    flex: 1 1 100px;
    min-width: 0;
  }

  .zip-btn {
    flex: 1 1 auto;
  }

  .export-zip-hinweis {
    color: var(--muted);
    font-size: 12px;
    margin: -4px 0 0;
  }

  .fehler {
    color: var(--status-offen);
    font-weight: 600;
    margin: 0;
  }

  .loeschen-block {
    display: grid;
    gap: 10px;
    border-color: var(--status-offen);
    margin-bottom: 20px;
  }

  .loeschen-titel {
    font-weight: 700;
    margin: 0;
  }

  .loeschen-block .backup-hinweis {
    color: var(--status-offen);
    font-weight: 600;
    margin: 0;
  }

  .loeschen-aktionen {
    display: flex;
    gap: 10px;
  }

  .loeschen-aktionen .btn {
    flex: 1 1 0;
    min-width: 0;
  }

  .loeschen-bestaetigen-btn {
    background: var(--status-offen);
    color: #fff;
  }

  .btn-klein {
    min-height: 40px;
    padding: 0 14px;
    font-size: 14px;
  }

  .filter-leiste {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
    margin-bottom: 20px;
  }

  .filter-btn {
    flex: 0 0 auto;
    padding: 8px 14px;
    min-height: 36px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--card);
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .filter-btn.aktiv {
    background: var(--navy);
    border-color: var(--navy);
    color: #fff;
  }

  .anlage-gruppe {
    margin-bottom: 24px;
  }

  .anlage-kopf {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: none;
    border: 0;
    padding: 6px 0;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .anlage-chevron {
    flex: 0 0 auto;
    width: 14px;
  }

  .anlage-anzahl {
    font-weight: 400;
    letter-spacing: normal;
    text-transform: none;
  }

  .punkte-liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }

  .punkt-zeile {
    padding: 0;
    display: flex;
    align-items: center;
  }

  .punkt-zeile.geloescht {
    opacity: 0.55;
  }

  .punkt-inhalt {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    text-align: left;
    background: none;
    border: 0;
    padding: 12px;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  .punkt-inhalt:disabled {
    cursor: default;
  }

  .punkt-zeile.geloescht .punkt-nr,
  .punkt-zeile.geloescht .punkt-bg {
    text-decoration: line-through;
  }

  .punkt-nr {
    font-weight: 700;
    flex: 0 0 auto;
  }

  .punkt-bg {
    color: var(--muted);
    font-size: 14px;
    margin-left: 8px;
  }

  .punkt-fotos {
    font-size: 12px;
    color: var(--muted);
    margin-left: auto;
  }

  .wiederherstellen-btn {
    margin: 12px 12px 12px 0;
    flex: 0 0 auto;
  }

  .hinweis {
    color: var(--muted);
    text-align: center;
    padding: 40px 0;
  }

  .fab {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    max-width: 608px;
    margin: 0 auto;
  }

  .pdf-vorschau-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: var(--card);
    display: flex;
    flex-direction: column;
  }

  .pdf-vorschau-kopf {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
    border-bottom: 1px solid var(--line);
  }

  .pdf-vorschau-titel {
    font-weight: 700;
    font-size: 16px;
  }

  .pdf-vorschau-frame {
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--bg);
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .pdf-seite {
    width: 100%;
    max-width: 480px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    border-radius: 2px;
  }

  .pdf-laedt-hinweis {
    color: var(--muted);
    font-size: 13px;
    padding: 4px 0 12px;
  }

  .pdf-vorschau-fuss {
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
  }

  .pdf-vorschau-fuss .btn {
    width: 100%;
  }
</style>
