<script lang="ts">
  import { db, ladeEinstellungen, punktLoeschen } from '../lib/db';
  import type { Baugruppe, Bericht, Foto, Lage, Punkt, PunktStatus } from '../lib/model';
  import { texte } from '../lib/texte/de';
  import { komprimiereFoto } from '../lib/foto';
  import Ziffernblatt from '../components/Ziffernblatt.svelte';
  import FotoPfeil from '../components/FotoPfeil.svelte';

  interface FotoEntwurf {
    id: string;
    blob: Blob;
    url: string;
    breite: number;
    hoehe: number;
    pfeil?: { x1: number; y1: number; x2: number; y2: number };
    erstelltAm: string;
  }

  let { berichtId, punktId, punktIds = [], onFertig, onNavigieren }: {
    berichtId: string;
    punktId: string | null;
    punktIds?: string[];
    onFertig: () => void;
    onNavigieren?: (punktId: string) => void;
  } = $props();

  let aktuellerIndex = $derived(punktId ? punktIds.indexOf(punktId) : -1);
  let hatVorherigen = $derived(aktuellerIndex > 0);
  let hatNaechsten = $derived(aktuellerIndex !== -1 && aktuellerIndex < punktIds.length - 1);

  let modusBearbeiten = $derived(punktId !== null);

  let geladen = $state(false);
  let ersteller = '';
  let baugruppenAktiv = $state<Baugruppe[]>([]);
  let bestehenderPunkt: Punkt | null = null;
  let bericht = $state<Bericht | null>(null);
  let anzeigeNr = $state<number | null>(null);

  let anlageNr = $state('');
  let lage = $state<Lage | null>(null);
  let baugruppeId = $state('');
  let anmerkung = $state('');
  let status = $state<PunktStatus>('offen');
  let fotos = $state<FotoEntwurf[]>([]);
  let vollbildFoto = $state<FotoEntwurf | null>(null);

  let versuchtGespeichert = $state(false);
  let anlageNrInput = $state<HTMLInputElement | null>(null);

  let vollstaendig = $derived(anlageNr.trim() !== '' && lage !== null && baugruppeId !== '');

  async function laden() {
    const [einstellungen, berichtGeladen] = await Promise.all([
      ladeEinstellungen(),
      db.berichte.get(berichtId),
    ]);
    ersteller = einstellungen.ersteller;
    baugruppenAktiv = einstellungen.baugruppen
      .filter((b) => b.aktiv)
      .sort((a, b) => a.sortierung - b.sortierung);
    bericht = berichtGeladen ?? null;

    if (punktId) {
      const punkt = await db.punkte.get(punktId);
      if (punkt) {
        bestehenderPunkt = punkt;
        anlageNr = punkt.anlageNr;
        lage = punkt.lage;
        baugruppeId = punkt.baugruppeId;
        anmerkung = punkt.anmerkung ?? '';
        status = punkt.status;
        anzeigeNr = punkt.nr;

        const bestehendeFotos = await db.fotos.where('punktId').equals(punktId).sortBy('reihenfolge');
        fotos = bestehendeFotos.map((f) => ({
          id: f.id,
          blob: f.blob,
          url: URL.createObjectURL(f.blob),
          breite: f.breite,
          hoehe: f.hoehe,
          pfeil: f.pfeil,
          erstelltAm: f.erstelltAm,
        }));
      }
    } else {
      const vorherigePunkte = await db.punkte.where('berichtId').equals(berichtId).toArray();
      vorherigePunkte.sort((a, b) => b.nr - a.nr);
      anlageNr = vorherigePunkte[0]?.anlageNr ?? '';
      anzeigeNr = bericht?.naechstePunktNr ?? null;
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
    for (const f of fotos) URL.revokeObjectURL(f.url);
    fotos = [];
  }

  async function fotoAufnehmen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const datei = input.files?.[0];
    input.value = '';
    if (!datei || fotos.length >= 3) return;

    const { blob, breite, hoehe } = await komprimiereFoto(datei);
    fotos.push({
      id: crypto.randomUUID(),
      blob,
      url: URL.createObjectURL(blob),
      breite,
      hoehe,
      erstelltAm: new Date().toISOString(),
    });
  }

  function fotoEntfernen(id: string) {
    const index = fotos.findIndex((f) => f.id === id);
    if (index === -1) return;
    URL.revokeObjectURL(fotos[index].url);
    fotos.splice(index, 1);
    if (vollbildFoto?.id === id) vollbildFoto = null;
  }

  function pfeilAktualisieren(id: string, pfeil: { x1: number; y1: number; x2: number; y2: number } | undefined) {
    const foto = fotos.find((f) => f.id === id);
    if (foto) foto.pfeil = pfeil;
  }

  $effect(() => {
    return () => {
      for (const f of fotos) URL.revokeObjectURL(f.url);
    };
  });

  async function speichernNeuerPunkt(): Promise<boolean> {
    versuchtGespeichert = true;
    if (!vollstaendig || !lage) return false;

    const baugruppe = baugruppenAktiv.find((b) => b.id === baugruppeId);
    const jetzt = new Date().toISOString();
    const lageWert = lage;
    const fotosZuSpeichern = $state.snapshot(fotos);
    let vergebeneNr: number | null = null;

    await db.transaction('rw', db.berichte, db.punkte, db.fotos, async () => {
      const berichtAktuell = await db.berichte.get(berichtId);
      if (!berichtAktuell) return;
      const nr = berichtAktuell.naechstePunktNr;
      vergebeneNr = nr;

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

      for (let i = 0; i < fotosZuSpeichern.length; i++) {
        const f = fotosZuSpeichern[i];
        const foto: Foto = {
          id: f.id,
          punktId: neuerPunkt.id,
          reihenfolge: (i + 1) as 1 | 2 | 3,
          blob: f.blob,
          breite: f.breite,
          hoehe: f.hoehe,
          pfeil: f.pfeil,
          erstelltAm: f.erstelltAm,
        };
        await db.fotos.put(foto);
      }

      berichtAktuell.naechstePunktNr = nr + 1;
      berichtAktuell.geaendertAm = jetzt;
      await db.berichte.put(berichtAktuell);
    });

    if (vergebeneNr !== null) anzeigeNr = vergebeneNr + 1;
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

  async function speichernBearbeitenAktuell(): Promise<boolean> {
    versuchtGespeichert = true;
    if (!vollstaendig || !lage || !bestehenderPunkt) return false;

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

    const punktId2 = bestehenderPunkt.id;
    const fotosZuSpeichern = $state.snapshot(fotos);

    await db.transaction('rw', db.punkte, db.fotos, async () => {
      await db.punkte.put(aktualisiert);

      const vorhandeneIds = await db.fotos.where('punktId').equals(punktId2).primaryKeys();
      const aktuelleIds = new Set(fotosZuSpeichern.map((f) => f.id));
      for (const id of vorhandeneIds) {
        if (!aktuelleIds.has(id as string)) await db.fotos.delete(id);
      }

      for (let i = 0; i < fotosZuSpeichern.length; i++) {
        const f = fotosZuSpeichern[i];
        const foto: Foto = {
          id: f.id,
          punktId: punktId2,
          reihenfolge: (i + 1) as 1 | 2 | 3,
          blob: f.blob,
          breite: f.breite,
          hoehe: f.hoehe,
          pfeil: f.pfeil,
          erstelltAm: f.erstelltAm,
        };
        await db.fotos.put(foto);
      }
    });

    return true;
  }

  async function speichernBearbeiten() {
    const erfolgreich = await speichernBearbeitenAktuell();
    if (erfolgreich) onFertig();
  }

  async function zuPunkt(richtung: 'zurueck' | 'weiter') {
    if (!onNavigieren) return;
    const erfolgreich = await speichernBearbeitenAktuell();
    if (!erfolgreich) return;
    const zielIndex = aktuellerIndex + (richtung === 'weiter' ? 1 : -1);
    const zielId = punktIds[zielIndex];
    if (zielId) onNavigieren(zielId);
  }

  let kopiertSichtbar = $state(false);

  async function anmerkungKopieren() {
    if (!anmerkung) return;
    await navigator.clipboard.writeText(anmerkung);
    kopiertSichtbar = true;
    setTimeout(() => (kopiertSichtbar = false), 1500);
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
    <div class="titel-block">
      <h1>{modusBearbeiten ? texte.punktForm.titelBearbeiten : texte.punktForm.titelNeu}</h1>
      {#if bericht}
        <p class="kontext">
          {bericht.projektNr} · {bericht.projektName}
          {#if anzeigeNr !== null}
            · Punkt #{anzeigeNr}
          {/if}
        </p>
      {/if}
    </div>
    {#if modusBearbeiten && onNavigieren && punktIds.length > 1}
      <div class="punkt-nav">
        <button
          class="btn btn-secondary btn-klein"
          onclick={() => zuPunkt('zurueck')}
          disabled={!hatVorherigen}
          aria-label={texte.punktForm.vorherigerPunkt}
        >
          ‹
        </button>
        <button
          class="btn btn-secondary btn-klein"
          onclick={() => zuPunkt('weiter')}
          disabled={!hatNaechsten}
          aria-label={texte.punktForm.naechsterPunkt}
        >
          ›
        </button>
      </div>
    {/if}
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

      <div class="feld-block feld-block-links">
        <span class="feld-label">{texte.punktForm.fotos}</span>
        <div class="fotos-grid">
          {#each fotos as foto (foto.id)}
            <div class="foto-kachel">
              <button class="foto-vorschau" onclick={() => (vollbildFoto = foto)} aria-label="Foto ansehen">
                <img src={foto.url} alt="" />
                {#if foto.pfeil}
                  <span class="pfeil-marker">➚</span>
                {/if}
              </button>
              <button class="foto-entfernen" onclick={() => fotoEntfernen(foto.id)} aria-label="Foto entfernen">×</button>
            </div>
          {/each}
          <label class="foto-aufnehmen" class:deaktiviert={fotos.length >= 3}>
            <input type="file" accept="image/*" disabled={fotos.length >= 3} onchange={fotoAufnehmen} />
            <span>+ {texte.punktForm.fotoAufnehmen}</span>
          </label>
        </div>
      </div>

      <label>
        <span class="anmerkung-kopf">
          {texte.punktForm.anmerkung}
          <button
            type="button"
            class="anmerkung-kopieren"
            onclick={anmerkungKopieren}
            disabled={!anmerkung}
            aria-label={texte.punktForm.anmerkungKopieren}
          >
            {kopiertSichtbar ? texte.punktForm.kopiert : '⧉'}
          </button>
        </span>
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

{#if vollbildFoto}
  <FotoPfeil
    url={vollbildFoto.url}
    breite={vollbildFoto.breite}
    hoehe={vollbildFoto.hoehe}
    pfeil={vollbildFoto.pfeil}
    onSchliessen={() => (vollbildFoto = null)}
    onAktualisieren={(pfeil) => vollbildFoto && pfeilAktualisieren(vollbildFoto.id, pfeil)}
  />
{/if}

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px 16px 120px;
  }

  .page-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .page-head .btn {
    flex: 0 0 auto;
  }

  .titel-block {
    flex: 1 1 auto;
    min-width: 0;
  }

  .punkt-nav {
    display: flex;
    gap: 6px;
    flex: 0 0 auto;
  }

  .punkt-nav .btn {
    min-width: 40px;
    padding: 0 10px;
    font-size: 18px;
    line-height: 1;
  }

  .page-head h1 {
    font-size: 20px;
    overflow-wrap: break-word;
  }

  .kontext {
    font-size: 13px;
    color: var(--muted);
    margin-top: 2px;
    overflow-wrap: break-word;
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

  .feld-block-links {
    justify-items: stretch;
  }

  .feld-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
    align-self: flex-start;
  }

  .fotos-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .foto-kachel {
    position: relative;
    aspect-ratio: 1;
  }

  .foto-vorschau {
    width: 100%;
    height: 100%;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
    background: var(--card);
    cursor: pointer;
  }

  .foto-vorschau img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .pfeil-marker {
    position: absolute;
    right: 4px;
    bottom: 4px;
    background: #e30613;
    color: #fff;
    font-size: 12px;
    line-height: 1;
    padding: 3px 4px;
    border-radius: 4px;
  }

  .foto-entfernen {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 24px;
    height: 24px;
    min-height: 0;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--card);
    color: var(--ink);
    font-size: 15px;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }

  .foto-aufnehmen {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--line);
    border-radius: 8px;
    color: var(--navy);
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    cursor: pointer;
    margin: 0;
  }

  .foto-aufnehmen.deaktiviert {
    color: var(--muted);
    opacity: 0.6;
    cursor: default;
  }

  .foto-aufnehmen input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
    min-height: 0;
    padding: 0;
    border: 0;
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

  .anmerkung-kopf {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .anmerkung-kopieren {
    background: none;
    border: 0;
    padding: 2px 6px;
    min-height: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--navy);
    cursor: pointer;
  }

  .anmerkung-kopieren:disabled {
    color: var(--muted);
    cursor: default;
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
