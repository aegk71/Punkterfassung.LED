<script lang="ts">
  import { db, ladeEinstellungen } from '../lib/db';
  import type { Baugruppe, Einstellungen } from '../lib/model';
  import { texte } from '../lib/texte/de';

  let { onZurueck }: { onZurueck: () => void } = $props();

  let einstellungen = $state<Einstellungen | null>(null);
  let neueBaugruppe = $state('');

  let speicherPersistiert = $state<boolean | null>(null);
  let speicherVerwendetMb = $state<number | null>(null);
  let speicherVerfuegbarMb = $state<number | null>(null);

  async function laden() {
    einstellungen = await ladeEinstellungen();

    if (navigator.storage?.persisted) {
      speicherPersistiert = await navigator.storage.persisted();
    }
    if (navigator.storage?.estimate) {
      const schaetzung = await navigator.storage.estimate();
      speicherVerwendetMb = (schaetzung.usage ?? 0) / (1024 * 1024);
      speicherVerfuegbarMb = (schaetzung.quota ?? 0) / (1024 * 1024);
    }
  }

  laden();

  async function speichern() {
    if (!einstellungen) return;
    await db.einstellungen.put($state.snapshot(einstellungen));
  }

  function erstellerGeaendert(wert: string) {
    if (!einstellungen) return;
    einstellungen.ersteller = wert;
    speichern();
  }

  function sortierteBaugruppen(): Baugruppe[] {
    if (!einstellungen) return [];
    return [...einstellungen.baugruppen].sort((a, b) => a.sortierung - b.sortierung);
  }

  function umbenennen(baugruppe: Baugruppe, name: string) {
    baugruppe.name = name;
    speichern();
  }

  function aktivUmschalten(baugruppe: Baugruppe) {
    baugruppe.aktiv = !baugruppe.aktiv;
    speichern();
  }

  function verschieben(baugruppe: Baugruppe, richtung: -1 | 1) {
    const liste = sortierteBaugruppen();
    const index = liste.findIndex((b) => b.id === baugruppe.id);
    const zielIndex = index + richtung;
    if (zielIndex < 0 || zielIndex >= liste.length) return;
    const temp = liste[zielIndex].sortierung;
    liste[zielIndex].sortierung = liste[index].sortierung;
    liste[index].sortierung = temp;
    speichern();
  }

  function hinzufuegen() {
    if (!einstellungen || neueBaugruppe.trim() === '') return;
    const maxSortierung = einstellungen.baugruppen.reduce((max, b) => Math.max(max, b.sortierung), -1);
    einstellungen.baugruppen.push({
      id: crypto.randomUUID(),
      name: neueBaugruppe.trim(),
      aktiv: true,
      sortierung: maxSortierung + 1,
    });
    neueBaugruppe = '';
    speichern();
  }
</script>

<div class="page">
  <header class="page-head">
    <button class="btn btn-secondary" onclick={onZurueck}>{texte.einstellungen.zurueck}</button>
    <h1>{texte.einstellungen.titel}</h1>
  </header>

  {#if einstellungen}
    <section class="block">
      <label>
        {texte.einstellungen.ersteller}
        <input
          type="text"
          value={einstellungen.ersteller}
          oninput={(e) => erstellerGeaendert(e.currentTarget.value)}
        />
      </label>
      <p class="hinweis">{texte.einstellungen.ersteller_hinweis}</p>
    </section>

    <section class="block">
      <h2 class="section-label">{texte.einstellungen.baugruppen}</h2>
      <ul class="baugruppen-liste">
        {#each sortierteBaugruppen() as baugruppe (baugruppe.id)}
          <li class="card baugruppe-zeile" class:inaktiv={!baugruppe.aktiv}>
            <input
              type="text"
              class="baugruppe-name"
              value={baugruppe.name}
              oninput={(e) => umbenennen(baugruppe, e.currentTarget.value)}
            />
            <div class="baugruppe-aktionen">
              <button class="btn-icon" onclick={() => verschieben(baugruppe, -1)} aria-label="nach oben">↑</button>
              <button class="btn-icon" onclick={() => verschieben(baugruppe, 1)} aria-label="nach unten">↓</button>
              <button class="btn btn-secondary btn-klein" onclick={() => aktivUmschalten(baugruppe)}>
                {baugruppe.aktiv ? texte.einstellungen.aktiv : texte.einstellungen.inaktiv}
              </button>
            </div>
          </li>
        {/each}
      </ul>

      <div class="neu-zeile">
        <input
          type="text"
          placeholder={texte.einstellungen.baugruppeNeu}
          bind:value={neueBaugruppe}
        />
        <button class="btn btn-primary" onclick={hinzufuegen}>{texte.einstellungen.hinzufuegen}</button>
      </div>
    </section>

    <section class="block">
      <h2 class="section-label">{texte.einstellungen.speicherTitel}</h2>
      {#if speicherPersistiert !== null}
        <p class="speicher-status" class:ok={speicherPersistiert}>
          {speicherPersistiert ? texte.einstellungen.speicherPersistiertJa : texte.einstellungen.speicherPersistiertNein}
        </p>
      {/if}
      {#if speicherVerwendetMb !== null && speicherVerfuegbarMb !== null}
        <p class="hinweis">
          {speicherVerwendetMb.toFixed(1)} MB von {speicherVerfuegbarMb.toFixed(0)} MB verwendet
        </p>
      {/if}
      <p class="hinweis">{texte.einstellungen.speicherHinweis}</p>
    </section>
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

  .block {
    margin-bottom: 28px;
  }

  label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }

  input[type='text'] {
    font: inherit;
    font-weight: 400;
    color: var(--ink);
    padding: 12px;
    min-height: 48px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
  }

  .hinweis {
    color: var(--muted);
    font-size: 13px;
    margin: 6px 0 0;
  }

  .baugruppen-liste {
    list-style: none;
    margin: 0 0 12px;
    padding: 0;
    display: grid;
    gap: 10px;
  }

  .baugruppe-zeile {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .baugruppe-zeile.inaktiv {
    opacity: 0.55;
  }

  .baugruppe-name {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    font-weight: 600;
    padding: 0 12px;
    min-height: 44px;
  }

  .baugruppe-aktionen {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .baugruppe-aktionen .btn-klein {
    margin-left: auto;
  }

  .btn-icon {
    width: 44px;
    height: 44px;
    border: 1px solid var(--line);
    background: var(--card);
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
  }

  .btn-klein {
    min-height: 44px;
    padding: 0 14px;
    font-size: 13px;
  }

  .neu-zeile {
    display: flex;
    gap: 10px;
  }

  .neu-zeile input {
    flex: 1 1 auto;
    min-width: 0;
  }

  .speicher-status {
    font-weight: 600;
    color: var(--status-offen);
    margin: 0 0 6px;
  }

  .speicher-status.ok {
    color: var(--status-erledigt);
  }
</style>
