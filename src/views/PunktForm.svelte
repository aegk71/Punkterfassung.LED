<script lang="ts">
  import { db, ladeEinstellungen, punktLoeschen } from '../lib/db';
  import type { Baugruppe, Lage, Punkt, PunktStatus } from '../lib/model';
  import { texte } from '../lib/texte/de';
  import Ziffernblatt from '../components/Ziffernblatt.svelte';

  let { berichtId, punktId, onFertig }: {
    berichtId: string;
    punktId: string | null;
    onFertig: () => void;
  } = $props();

  let modusBearbeiten = $derived(punktId !== null);

  let geladen = $state(false);
  let ersteller = '';
  let baugruppenAktiv = $state<Baugruppe[]>([]);
  let bestehenderPunkt: Punkt | null = null;

  let anlageNr = $state('');
  let lage = $state<Lage | null>(null);
  let baugruppeId = $state('');
  let anmerkung = $state('');
  let status = $state<PunktStatus>('offen');

  let versuchtGespeichert = $state(false);
  let anlageNrInput = $state<HTMLInputElement | null>(null);

  let vollstaendig = $derived(anlageNr.trim() !== '' && lage !== null && baugruppeId !== '');

  async function laden() {
    const einstellungen = await ladeEinstellungen();
    ersteller = einstellungen.ersteller;
    baugruppenAktiv = einstellungen.baugruppen
      .filter((b) => b.aktiv)
      .sort((a, b) => a.sortierung - b.sortierung);

    if (punktId) {
      const punkt = await db.punkte.get(punktId);
      if (punkt) {
        bestehenderPunkt = punkt;
        anlageNr = punkt.anlageNr;
        lage = punkt.lage;
        baugruppeId = punkt.baugruppeId;
        anmerkung = punkt.anmerkung ?? '';
        status = punkt.status;
      }
    } else {
      const vorherigePunkte = await db.punkte.where('berichtId').equals(berichtId).toArray();
      vorherigePunkte.sort((a, b) => b.nr - a.nr);
      anlageNr = vorherigePunkte[0]?.anlageNr ?? '';
    }
    geladen = true;
  }

  laden();

  function formularZuruecksetzen(anlageNrBehalten: string) {
    anlageNr = anlageNrBehalten;
    lage = null;
    baugruppeId = '';
    anmerkung = '';
    status = 'offen';
    versuchtGespeichert = false;
  }

  async function speichernNeuerPunkt(): Promise<boolean> {
    versuchtGespeichert = true;
    if (!vollstaendig || !lage) return false;

    const baugruppe = baugruppenAktiv.find((b) => b.id === baugruppeId);
    const jetzt = new Date().toISOString();
    const lageWert = lage;

    await db.transaction('rw', db.berichte, db.punkte, async () => {
      const bericht = await db.berichte.get(berichtId);
      if (!bericht) return;
      const nr = bericht.naechstePunktNr;

      const neuerPunkt: Punkt = {
        id: crypto.randomUUID(),
        berichtId,
        nr,
        anlageNr: anlageNr.trim(),
        lage: lageWert,
        baugruppeId,
        baugruppeName: baugruppe?.name ?? '',
        status,
        anmerkung: anmerkung.trim() || undefined,
        erstelltAm: jetzt,
        geaendertAm: jetzt,
      };
      if (status === 'erledigt') neuerPunkt.erledigtAm = jetzt;

      await db.punkte.put(neuerPunkt);

      bericht.naechstePunktNr = nr + 1;
      bericht.geaendertAm = jetzt;
      await db.berichte.put(bericht);
    });

    return true;
  }

  async function speichernUndNaechster() {
    const behalteneAnlageNr = anlageNr.trim();
    const erfolgreich = await speichernNeuerPunkt();
    if (erfolgreich) formularZuruecksetzen(behalteneAnlageNr);
  }

  async function neueAnlage() {
    const erfolgreich = await speichernNeuerPunkt();
    if (erfolgreich) {
      formularZuruecksetzen('');
      anlageNrInput?.focus();
    }
  }

  async function speichernBearbeiten() {
    versuchtGespeichert = true;
    if (!vollstaendig || !lage || !bestehenderPunkt) return;

    const baugruppe = baugruppenAktiv.find((b) => b.id === baugruppeId);
    const aktualisiert: Punkt = {
      ...bestehenderPunkt,
      anlageNr: anlageNr.trim(),
      lage,
      baugruppeId,
      baugruppeName: baugruppe?.name ?? bestehenderPunkt.baugruppeName,
      anmerkung: anmerkung.trim() || undefined,
      status,
      geaendertAm: new Date().toISOString(),
    };

    if (status === 'erledigt') {
      aktualisiert.erledigtAm =
        bestehenderPunkt.status === 'erledigt' ? bestehenderPunkt.erledigtAm : new Date().toISOString();
    } else {
      delete aktualisiert.erledigtAm;
    }

    await db.punkte.put(aktualisiert);
    onFertig();
  }

  let loeschenBestaetigenSichtbar = $state(false);
  let loeschenGrund = $state('');

  function loeschenStarten() {
    loeschenBestaetigenSichtbar = true;
  }

  function loeschenAbbrechen() {
    loeschenBestaetigenSichtbar = false;
    loeschenGrund = '';
  }

  async function loeschenBestaetigt() {
    if (!bestehenderPunkt) return;
    await punktLoeschen(bestehenderPunkt.id, ersteller, loeschenGrund.trim() || undefined);
    onFertig();
  }
</script>

<div class="page">
  <header class="page-head">
    <button class="btn btn-secondary" onclick={onFertig}>
      {modusBearbeiten ? texte.punktForm.abbrechen : texte.punktForm.fertig}
    </button>
    <h1>{modusBearbeiten ? texte.punktForm.titelBearbeiten : texte.punktForm.titelNeu}</h1>
  </header>

  {#if geladen}
    <div class="formular">
      <label>
        {texte.punktForm.anlageNr}
        <input type="text" bind:value={anlageNr} bind:this={anlageNrInput} />
      </label>

      <div class="feld-block">
        <span class="feld-label">{texte.punktForm.lage}</span>
        <Ziffernblatt bind:value={lage} />
      </div>

      <label>
        {texte.punktForm.baugruppe}
        <select bind:value={baugruppeId}>
          <option value="" disabled>{texte.punktForm.baugruppeBitteWaehlen}</option>
          {#each baugruppenAktiv as bg (bg.id)}
            <option value={bg.id}>{bg.name}</option>
          {/each}
        </select>
      </label>

      <label>
        {texte.punktForm.anmerkung}
        <textarea bind:value={anmerkung} rows="3"></textarea>
      </label>

      <label>
        {texte.punktForm.status}
        <select bind:value={status}>
          <option value="offen">{texte.status.offen}</option>
          <option value="in_bearbeitung">{texte.status.in_bearbeitung}</option>
          <option value="erledigt">{texte.status.erledigt}</option>
        </select>
      </label>

      {#if versuchtGespeichert && !vollstaendig}
        <p class="fehler">{texte.punktForm.pflichtfeldHinweis}</p>
      {/if}

      {#if loeschenBestaetigenSichtbar}
        <div class="card loeschen-block">
          <p class="loeschen-frage">{texte.punktForm.loeschenBestaetigen}</p>
          <label>
            {texte.punktForm.loeschenGrundFrage}
            <input type="text" bind:value={loeschenGrund} />
          </label>
          <div class="loeschen-aktionen">
            <button class="btn btn-secondary" onclick={loeschenAbbrechen}>{texte.berichtForm.abbrechen}</button>
            <button class="btn loeschen-bestaetigen-btn" onclick={loeschenBestaetigt}>{texte.punktForm.loeschen}</button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="aktionen-leiste">
    {#if modusBearbeiten}
      <button class="btn btn-secondary" onclick={loeschenStarten}>{texte.punktForm.loeschen}</button>
      <button class="btn btn-primary" onclick={speichernBearbeiten}>{texte.punktForm.speichern}</button>
    {:else}
      <button class="btn btn-secondary" onclick={neueAnlage}>{texte.punktForm.neueAnlage}</button>
      <button class="btn btn-primary" onclick={speichernUndNaechster}>{texte.punktForm.speichernNaechster}</button>
    {/if}
  </div>
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px 16px 120px;
  }

  .page-head {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }

  .page-head h1 {
    font-size: 20px;
  }

  .formular {
    display: grid;
    gap: 20px;
  }

  label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }

  .feld-block {
    display: grid;
    gap: 8px;
    justify-items: center;
  }

  .feld-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
    align-self: flex-start;
  }

  input,
  textarea,
  select {
    font: inherit;
    font-weight: 400;
    color: var(--ink);
    padding: 12px;
    min-height: 48px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
  }

  textarea {
    resize: vertical;
  }

  .fehler {
    color: var(--status-offen);
    font-weight: 600;
    margin: 0;
  }

  .loeschen-block {
    display: grid;
    gap: 14px;
    border-color: var(--status-offen);
  }

  .loeschen-frage {
    font-weight: 700;
    color: var(--ink);
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

  .aktionen-leiste {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    gap: 10px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: var(--bg);
    border-top: 1px solid var(--line);
  }

  .aktionen-leiste .btn {
    flex: 1 1 0;
    min-width: 0;
  }
</style>
