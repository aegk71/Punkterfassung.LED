<script lang="ts">
  import { db } from '../lib/db';
  import type { Bericht } from '../lib/model';
  import { texte } from '../lib/texte/de';
  import { formatDeutsch } from '../lib/datum';

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
</script>

<div class="page">
  <header class="page-head">
    <h1>{texte.berichtsliste.titel}</h1>
    <button class="btn btn-secondary" onclick={onEinstellungen}>{texte.berichtsliste.einstellungen}</button>
  </header>

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
    margin-bottom: 20px;
  }

  .page-head h1 {
    font-size: 22px;
  }

  .hinweis {
    color: var(--muted);
    text-align: center;
    padding: 40px 0;
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
