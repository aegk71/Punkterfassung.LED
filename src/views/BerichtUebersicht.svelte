<script lang="ts">
  import { db, punktWiederherstellen } from '../lib/db';
  import type { Bericht, Foto, Punkt } from '../lib/model';
  import { texte } from '../lib/texte/de';
  import { naturalCompare } from '../lib/naturalSort';
  import { heuteIso } from '../lib/datum';
  import { exportDateiname } from '../lib/export/dateiname';
  import { dateiBereitstellen } from '../lib/export/teilen';
  import ZiffernblattSymbol from '../components/ZiffernblattSymbol.svelte';

  let { berichtId, onZurueck, onBearbeiten, onNeuerPunkt, onPunktOeffnen }: {
    berichtId: string;
    onZurueck: () => void;
    onBearbeiten: (berichtId: string) => void;
    onNeuerPunkt: (berichtId: string) => void;
    onPunktOeffnen: (berichtId: string, punktId: string) => void;
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

  async function statusUmschalten() {
    if (!bericht) return;
    bericht.status = bericht.status === 'offen' ? 'abgeschlossen' : 'offen';
    bericht.geaendertAm = new Date().toISOString();
    await db.berichte.put(bericht);
  }

  async function wiederherstellen(punktId: string) {
    await punktWiederherstellen(punktId);
    await laden();
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

  function exportStarten() {
    exportSichtbar = true;
    exportFehler = '';
  }

  function exportAbbrechen() {
    exportSichtbar = false;
  }

  async function exportAusfuehren(format: 'excel' | 'pdf') {
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
      } else {
        const { berichtAlsPdf } = await import('../lib/export/pdf');
        const blob = await berichtAlsPdf(bericht, punkteFuerExport, alleFotosProPunkt);
        const dateiname = exportDateiname(bericht.projektNr, bericht.vorgang, heuteIso(), 'pdf');
        await dateiBereitstellen(blob, dateiname, 'application/pdf');
      }
      exportSichtbar = false;
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
      <h1>{bericht.projektNr} · {bericht.projektName} · {bericht.vorgang}</h1>
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
    </div>

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
          <h2 class="section-label">Anlage {gruppe.anlageNr}</h2>
          <ul class="punkte-liste">
            {#each gruppe.punkte as punkt (punkt.id)}
              <li class="card punkt-zeile" class:geloescht={!!punkt.geloescht}>
                <button
                  class="punkt-inhalt"
                  disabled={!!punkt.geloescht}
                  onclick={() => onPunktOeffnen(berichtId, punkt.id)}
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
        </section>
      {/each}
    {/if}
  {/if}

  <button class="btn btn-primary fab" onclick={() => onNeuerPunkt(berichtId)}>
    {texte.berichtUebersicht.neuerPunkt}
  </button>
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

  .page-head h1 {
    font-size: 18px;
    flex: 1 1 auto;
    min-width: 0;
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

  .fehler {
    color: var(--status-offen);
    font-weight: 600;
    margin: 0;
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
</style>
