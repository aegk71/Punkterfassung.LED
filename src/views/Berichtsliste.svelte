<script lang="ts">
  import { db } from '../lib/db';
  import type { Bericht } from '../lib/model';
  import { texte } from '../lib/texte/de';
  import { formatDeutsch } from '../lib/datum';
  import type { ZipImportModus } from '../lib/export/zip';

  let { onNeu, onOeffnen, onEinstellungen }: {
    onNeu: () => void;
    onOeffnen: (berichtId: string) => void;
    onEinstellungen: () => void;
  } = $props();

  let berichte = $state<Bericht[]>([]);
  let zaehlerProBericht = $state<Record<string, { offen: number; in_bearbeitung: number; erledigt: number }>>({});
  let geladen = $state(false);

  async function laden() {
    const [alleBerichte, allePunkte] = await Promise.all([
      db.berichte.toArray(),
      db.punkte.toArray(),
    ]);
    alleBerichte.sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm));
    berichte = alleBerichte;

    const zaehler: typeof zaehlerProBericht = {};
    for (const bericht of alleBerichte) {
      zaehler[bericht.id] = { offen: 0, in_bearbeitung: 0, erledigt: 0 };
    }
    for (const punkt of allePunkte) {
      if (punkt.geloescht) continue;
      const eintrag = zaehler[punkt.berichtId];
      if (eintrag) eintrag[punkt.status]++;
    }
    zaehlerProBericht = zaehler;
    geladen = true;
  }

  laden();

  function tageOhneBackup(bericht: Bericht): number | null {
    if (bericht.status !== 'offen') return null;
    const referenz = new Date(bericht.letzteSicherung ?? bericht.erstelltAm).getTime();
    const tage = Math.floor((Date.now() - referenz) / (1000 * 60 * 60 * 24));
    return tage > 7 ? tage : null;
  }

  let zipDateiInput = $state<HTMLInputElement | null>(null);
  let zipImportLaeuft = $state(false);
  let zipImportFehler = $state('');
  let zipKollisionDatei = $state<File | null>(null);
  let zipKollisionBericht = $state<Bericht | null>(null);

  function zipImportStarten() {
    zipImportFehler = '';
    zipDateiInput?.click();
  }

  async function zipDateiAusgewaehlt(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const datei = input.files?.[0];
    input.value = '';
    if (!datei) return;

    zipImportFehler = '';
    zipImportLaeuft = true;
    try {
      const { zipVorabPruefen, zipImportieren } = await import('../lib/export/zip');
      const { bericht, kollision } = await zipVorabPruefen(datei);
      if (kollision) {
        zipKollisionDatei = datei;
        zipKollisionBericht = bericht;
      } else {
        const berichtId = await zipImportieren(datei, 'ersetzen');
        onOeffnen(berichtId);
      }
    } catch (err) {
      zipImportFehler = err instanceof Error ? err.message : texte.berichtsliste.zipImportFehler;
    } finally {
      zipImportLaeuft = false;
    }
  }

  async function zipKollisionAufloesen(modus: ZipImportModus) {
    if (!zipKollisionDatei) return;
    zipImportLaeuft = true;
    zipImportFehler = '';
    try {
      const { zipImportieren } = await import('../lib/export/zip');
      const berichtId = await zipImportieren(zipKollisionDatei, modus);
      zipKollisionDatei = null;
      zipKollisionBericht = null;
      onOeffnen(berichtId);
    } catch (err) {
      zipImportFehler = err instanceof Error ? err.message : texte.berichtsliste.zipImportFehler;
    } finally {
      zipImportLaeuft = false;
    }
  }

  function zipKollisionAbbrechen() {
    zipKollisionDatei = null;
    zipKollisionBericht = null;
  }
</script>

<div class="page">
  <header class="page-head">
    <h1>{texte.berichtsliste.titel}</h1>
    <div class="kopf-aktionen">
      <button class="btn btn-secondary btn-klein" onclick={zipImportStarten} disabled={zipImportLaeuft}>
        {texte.berichtsliste.zipImport}
      </button>
      <button class="btn btn-secondary btn-klein" onclick={onEinstellungen}>{texte.berichtsliste.einstellungen}</button>
    </div>
    <input
      type="file"
      accept=".zip,application/zip"
      class="datei-input"
      bind:this={zipDateiInput}
      onchange={zipDateiAusgewaehlt}
    />
  </header>

  {#if zipImportFehler}
    <p class="fehler">{zipImportFehler}</p>
  {/if}

  {#if zipKollisionBericht}
    <div class="card kollision-block">
      <p class="kollision-titel">{zipKollisionBericht.projektNr} · {zipKollisionBericht.projektName}</p>
      <p>{texte.berichtsliste.zipKollisionFrage}</p>
      <div class="kollision-aktionen">
        <button class="btn btn-secondary" onclick={zipKollisionAbbrechen} disabled={zipImportLaeuft}>
          {texte.berichtsliste.abbrechen}
        </button>
        <button class="btn btn-secondary" onclick={() => zipKollisionAufloesen('kopie')} disabled={zipImportLaeuft}>
          {texte.berichtsliste.zipKollisionKopie}
        </button>
        <button class="btn btn-primary" onclick={() => zipKollisionAufloesen('ersetzen')} disabled={zipImportLaeuft}>
          {texte.berichtsliste.zipKollisionErsetzen}
        </button>
      </div>
    </div>
  {/if}

  {#if geladen}
    {#if berichte.length === 0}
      <p class="hinweis">{texte.berichtsliste.keineBerichte}</p>
    {:else}
      <ul class="liste">
        {#each berichte as bericht (bericht.id)}
          <li>
            <button class="card karte" onclick={() => onOeffnen(bericht.id)}>
              <div class="karte-kopf">
                <span class="karte-titel">{bericht.projektNr} · {bericht.projektName}</span>
                <span class="karte-datum">{formatDeutsch(bericht.datum)}</span>
              </div>
              <p class="karte-vorgang">{bericht.vorgang}</p>
              <div class="karte-badges">
                <span class="badge badge-offen">{zaehlerProBericht[bericht.id]?.offen ?? 0} {texte.berichtsliste.punkteOffen}</span>
                <span class="badge badge-in_bearbeitung">{zaehlerProBericht[bericht.id]?.in_bearbeitung ?? 0} {texte.berichtsliste.punkteInBearbeitung}</span>
                <span class="badge badge-erledigt">{zaehlerProBericht[bericht.id]?.erledigt ?? 0} {texte.berichtsliste.punkteErledigt}</span>
              </div>
              {#if tageOhneBackup(bericht) !== null}
                <p class="backup-hinweis">{texte.berichtsliste.zipBackupHinweis(tageOhneBackup(bericht) ?? 0)}</p>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <button class="btn btn-primary fab" onclick={onNeu}>{texte.berichtsliste.neuerBericht}</button>
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
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }

  .page-head h1 {
    font-size: 22px;
  }

  .kopf-aktionen {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn-klein {
    min-height: 40px;
    padding: 0 14px;
    font-size: 14px;
  }

  .datei-input {
    display: none;
  }

  .fehler {
    color: var(--status-offen);
    font-weight: 600;
    margin: 0 0 16px;
  }

  .kollision-block {
    display: grid;
    gap: 10px;
    margin-bottom: 20px;
  }

  .kollision-titel {
    font-weight: 700;
    margin: 0;
  }

  .kollision-aktionen {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .kollision-aktionen .btn {
    flex: 1 1 100px;
    min-width: 0;
  }

  .hinweis {
    color: var(--muted);
    text-align: center;
    padding: 40px 0;
  }

  .backup-hinweis {
    color: var(--status-offen);
    font-size: 12px;
    font-weight: 600;
    margin: 8px 0 0;
  }

  .liste {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }

  .karte {
    width: 100%;
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
    display: block;
  }

  .karte-kopf {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }

  .karte-titel {
    font-weight: 700;
  }

  .karte-datum {
    color: var(--muted);
    font-size: 14px;
    white-space: nowrap;
  }

  .karte-vorgang {
    color: var(--muted);
    font-size: 15px;
    margin-bottom: 10px;
  }

  .karte-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
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
