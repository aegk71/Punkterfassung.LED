<script lang="ts">
  import type { Lage } from '../lib/model';
  import { tuerSegment, segmentMitte } from '../lib/tuer';

  let { lage, groesse = 22 }: { lage: Lage; groesse?: number } = $props();

  const breite = 20;
  const hoehe = 28;
  const rahmen = 6;

  let mitte = $derived(segmentMitte(tuerSegment(lage, breite, hoehe, rahmen)));
</script>

<svg
  viewBox={`0 0 ${breite} ${hoehe}`}
  width={groesse}
  height={(groesse * hoehe) / breite}
  class="symbol"
  aria-hidden="true"
>
  <rect x="0" y="0" width={breite} height={hoehe} class="rahmen-aussen" />
  <rect x={rahmen} y={rahmen} width={breite - 2 * rahmen} height={hoehe - 2 * rahmen} class="panel" />
  {#if lage === 'M'}
    <circle cx={breite / 2} cy={hoehe / 2} r="2.5" class="punkt" />
  {:else}
    <circle cx={mitte.x} cy={mitte.y} r="2" class="punkt" />
  {/if}
</svg>

<style>
  .symbol {
    flex: 0 0 auto;
  }

  .rahmen-aussen {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.2;
  }

  .panel {
    fill: none;
    stroke: var(--muted);
    stroke-width: 0.8;
    opacity: 0.5;
  }

  .punkt {
    fill: var(--navy);
  }
</style>
