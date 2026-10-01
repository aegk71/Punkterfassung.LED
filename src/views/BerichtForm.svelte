<script lang="ts">
  import { db, ladeEinstellungen } from '../lib/db';
  import type { Bericht, BerichtSprache } from '../lib/model';
  import { texte } from '../lib/texte/de';
  import { heuteIso } from '../lib/datum';

  let { berichtId, onGespeichert, onAbbrechen }: {
    berichtId: string | null;
    onGespeichert: (berichtId: string) => void;
    onAbbrechen: () => void;
  } = $props();

  let geladen = $state(false);
  let idBestehend: string | null = null;
  let erstelltAmBestehend = '';
  let naechstePunktNrBestehend = 1;
  let statusBestehend: Bericht['status'] = 'offen';

  let titel = $state('');
  let projektNr = $state('');
  let projektName = $state('');
  let vorgang = $state('');
  let beschreibung = $state('');
  let ersteller = $state('');
  let datum = $state(heuteIso());
  let neubauNr = $state('');
  let neubauName = $state('');
  let ort = $state('');
  let sprache = $state<BerichtSprache>('de');

  let versuchtGespeichert = $state(false);

  let vollstaendig = $derived(
    projektNr.trim() !== '' &&
      projektName.trim() !== '' &&
      vorgang.trim() !== '' &&
      beschreibung.trim() !== '' &&
      ersteller.trim() !== '' &&
      datum.trim() !== '',
  );

  async function laden() {
    if (berichtId) {
      const bericht = await db.berichte.get(berichtId);
      if (bericht) {
        idBestehend = bericht.id;
        erstelltAmBestehend = bericht.erstelltAm;
        naechstePunktNrBestehend = bericht.naechstePunktNr;
        statusBestehend = bericht.status;
        titel = bericht.titel ?? '';
        projektNr = bericht.projektNr;
        projektName = bericht.projektName;
        vorgang = bericht.vorgang;
        beschreibung = bericht.beschreibung;
        ersteller = bericht.ersteller;
        datum = bericht.datum;
        neubauNr = bericht.neubauNr ?? '';
        neubauName = bericht.neubauName ?? '';
        ort = bericht.ort ?? '';
        sprache = bericht.sprache ?? 'de';
      }
    } else {
      const einstellungen = await ladeEinstellungen();
      ersteller = einstellungen.ersteller;
    }
    geladen = true;
  }

  laden();

  async function speichern() {
    versuchtGespeichert = true;
    if (!vollstaendig) return;

    const jetzt = new Date().toISOString();
    const bericht: Bericht = {
      id: idBestehend ?? crypto.randomUUID(),
      titel: titel.trim() || undefined,
      projektNr: projektNr.trim(),
      projektName: projektName.trim(),
      vorgang: vorgang.trim(),
      beschreibung: beschreibung.trim(),
      ersteller: ersteller.trim(),
      datum,
      neubauNr: neubauNr.trim() || undefined,
      neubauName: neubauName.trim() || undefined,
      ort: ort.trim() || undefined,
      status: statusBestehend,
      sprache,
      naechstePunktNr: naechstePunktNrBestehend,
      erstelltAm: erstelltAmBestehend || jetzt,
      geaendertAm: jetzt,
    };

    await db.berichte.put(bericht);
    onGespeichert(bericht.id);
  }
</script>

<div class="page">
  <header class="page-head">
    <button class="btn btn-secondary" onclick={onAbbrechen}>{texte.berichtForm.abbrechen}</button>
    <h1>{berichtId ? texte.berichtForm.titelBearbeiten : texte.berichtForm.titelNeu}</h1>
  </header>

  {#if geladen}
    <form class="formular" onsubmit={(e) => { e.preventDefault(); speichern(); }}>
      <label>
        {texte.berichtForm.titel}
        <input type="text" bind:value={titel} placeholder={texte.berichtForm.titelPlatzhalter} />
      </label>
      <label>
        {texte.berichtForm.projektNr}
        <input type="text" bind:value={projektNr} required />
      </label>
      <label>
        {texte.berichtForm.projektName}
        <input type="text" bind:value={projektName} required />
      </label>
      <label>
        {texte.berichtForm.vorgang}
        <input type="text" bind:value={vorgang} required />
      </label>
      <label>
        {texte.berichtForm.beschreibung}
        <textarea bind:value={beschreibung} rows="3" required></textarea>
      </label>
      <label>
        {texte.berichtForm.ersteller}
        <input type="text" bind:value={ersteller} required />
      </label>
      <label>
        {texte.berichtForm.datum}
        <input type="date" bind:value={datum} required />
      </label>
      <label>
        {texte.berichtForm.neubauNr}
        <input type="text" bind:value={neubauNr} />
      </label>
      <label>
        {texte.berichtForm.neubauName}
        <input type="text" bind:value={neubauName} />
      </label>
      <label>
        {texte.berichtForm.ort}
        <input type="text" bind:value={ort} />
      </label>
      <label>
        {texte.berichtForm.sprache}
        <select bind:value={sprache}>
          <option value="de">{texte.berichtForm.spracheDeutsch}</option>
          <option value="en">{texte.berichtForm.spracheEnglisch}</option>
        </select>
      </label>

      {#if versuchtGespeichert && !vollstaendig}
        <p class="fehler">{texte.berichtForm.pflichtfeldHinweis}</p>
      {/if}

      <button type="submit" class="btn btn-primary">{texte.berichtForm.speichern}</button>
    </form>
  {/if}
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px 16px 40px;
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
    gap: 16px;
  }

  label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
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
</style>
