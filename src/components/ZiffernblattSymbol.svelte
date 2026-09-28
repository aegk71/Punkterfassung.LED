<script lang="ts">
  import type { Lage } from '../lib/model';
  import { polarZuXY } from '../lib/kreis';
  import { lageWinkel } from '../lib/lage';

  let { lage, groesse = 26 }: { lage: Lage; groesse?: number } = $props();

  const cx = 16;
  const cy = 16;
  const r = 13;

  let winkel = $derived(lageWinkel(lage));
  let punkt = $derived(polarZuXY(cx, cy, r - 3, winkel));
</script>

<svg viewBox="0 0 32 32" width={groesse} height={groesse} class="symbol" aria-hidden="true">
  <circle cx={cx} cy={cy} r={r} class="ring" />
  <line x1={cx} y1={cy - r} x2={cx} y2={cy - r + 3} class="marke" />
  {#if lage === 'M'}
    <circle cx={cx} cy={cy} r="4" class="punkt" />
  {:else}
    <circle cx={punkt.x} cy={punkt.y} r="3" class="punkt" />
  {/if}
</svg>

<style>
  .symbol {
    flex: 0 0 auto;
  }

  .ring {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1.5;
  }

  .marke {
    stroke: var(--muted);
    stroke-width: 1.5;
  }

  .punkt {
    fill: var(--navy);
  }
</style>
