<script lang="ts">
  import Berichtsliste from './views/Berichtsliste.svelte';
  import BerichtForm from './views/BerichtForm.svelte';
  import BerichtUebersicht from './views/BerichtUebersicht.svelte';
  import PunktForm from './views/PunktForm.svelte';
  import Einstellungen from './views/Einstellungen.svelte';

  type Ruecksprung = { name: 'liste' } | { name: 'berichtUebersicht'; berichtId: string };

  type Ansicht =
    | { name: 'liste' }
    | { name: 'berichtForm'; berichtId: string | null; ruecksprung: Ruecksprung }
    | { name: 'berichtUebersicht'; berichtId: string }
    | { name: 'punktForm'; berichtId: string; punktId: string | null }
    | { name: 'einstellungen' };

  let ansicht = $state<Ansicht>({ name: 'liste' });

  function zuBerichtForm(berichtId: string | null, ruecksprung: Ruecksprung) {
    ansicht = { name: 'berichtForm', berichtId, ruecksprung };
  }
</script>

{#if ansicht.name === 'liste'}
  <Berichtsliste
    onNeu={() => zuBerichtForm(null, { name: 'liste' })}
    onOeffnen={(berichtId) => (ansicht = { name: 'berichtUebersicht', berichtId })}
    onEinstellungen={() => (ansicht = { name: 'einstellungen' })}
  />
{:else if ansicht.name === 'berichtForm'}
  {@const ruecksprung = ansicht.ruecksprung}
  <BerichtForm
    berichtId={ansicht.berichtId}
    onGespeichert={(berichtId) => (ansicht = { name: 'berichtUebersicht', berichtId })}
    onAbbrechen={() => (ansicht = ruecksprung)}
  />
{:else if ansicht.name === 'berichtUebersicht'}
  <BerichtUebersicht
    berichtId={ansicht.berichtId}
    onZurueck={() => (ansicht = { name: 'liste' })}
    onBearbeiten={(berichtId) => zuBerichtForm(berichtId, { name: 'berichtUebersicht', berichtId })}
    onNeuerPunkt={(berichtId) => (ansicht = { name: 'punktForm', berichtId, punktId: null })}
    onPunktOeffnen={(berichtId, punktId) => (ansicht = { name: 'punktForm', berichtId, punktId })}
  />
{:else if ansicht.name === 'punktForm'}
  {@const berichtIdAktuell = ansicht.berichtId}
  <PunktForm
    berichtId={berichtIdAktuell}
    punktId={ansicht.punktId}
    onFertig={() => (ansicht = { name: 'berichtUebersicht', berichtId: berichtIdAktuell })}
  />
{:else if ansicht.name === 'einstellungen'}
  <Einstellungen onZurueck={() => (ansicht = { name: 'liste' })} />
{/if}
