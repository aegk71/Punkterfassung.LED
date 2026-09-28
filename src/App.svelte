<script lang="ts">
  import Berichtsliste from './views/Berichtsliste.svelte';
  import BerichtForm from './views/BerichtForm.svelte';
  import Einstellungen from './views/Einstellungen.svelte';

  type Ansicht =
    | { name: 'liste' }
    | { name: 'berichtForm'; berichtId: string | null }
    | { name: 'einstellungen' };

  let ansicht = $state<Ansicht>({ name: 'liste' });
</script>

{#if ansicht.name === 'liste'}
  <Berichtsliste
    onNeu={() => (ansicht = { name: 'berichtForm', berichtId: null })}
    onOeffnen={(berichtId) => (ansicht = { name: 'berichtForm', berichtId })}
    onEinstellungen={() => (ansicht = { name: 'einstellungen' })}
  />
{:else if ansicht.name === 'berichtForm'}
  <BerichtForm
    berichtId={ansicht.berichtId}
    onGespeichert={() => (ansicht = { name: 'liste' })}
    onAbbrechen={() => (ansicht = { name: 'liste' })}
  />
{:else if ansicht.name === 'einstellungen'}
  <Einstellungen onZurueck={() => (ansicht = { name: 'liste' })} />
{/if}
