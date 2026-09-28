<script lang="ts">
  import type { Lage } from '../lib/model';
  import { segmentPfad, polarZuXY } from '../lib/kreis';
  import { lageText } from '../lib/lage';

  let { value = $bindable(null) }: { value: Lage | null } = $props();

  const cx = 130;
  const cy = 130;
  const aussenR = 118;
  const innenR = 46;
  const zahlen: Lage[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  function mittelwinkel(n: Lage): number {
    if (n === 'M') return 0;
    return (n % 12) * 30;
  }

  function waehlen(lage: Lage) {
    value = lage;
  }
</script>

<div class="ziffernblatt-wrapper">
  <svg viewBox="0 0 260 260" class="ziffernblatt">
    {#each zahlen as n (n)}
      {@const winkel = mittelwinkel(n)}
      {@const pfad = segmentPfad(cx, cy, innenR, aussenR, winkel - 15, winkel + 15)}
      {@const label = polarZuXY(cx, cy, (innenR + aussenR) / 2, winkel)}
      <path
        d={pfad}
        class="sektor"
        class:aktiv={value === n}
        role="button"
        tabindex="0"
        aria-label={`${n} Uhr`}
        onclick={() => waehlen(n)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && waehlen(n)}
      />
      <text x={label.x} y={label.y} class="sektor-label" class:aktiv={value === n}>{n}</text>
    {/each}
    <circle
      cx={cx}
      cy={cy}
      r={innenR}
      class="mitte"
      class:aktiv={value === 'M'}
      role="button"
      tabindex="0"
      aria-label="generell"
      onclick={() => waehlen('M')}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && waehlen('M')}
    />
    <text x={cx} y={cy} class="mitte-label" class:aktiv={value === 'M'}>M</text>
  </svg>
  <p class="hinweis">Ansicht von außen nach innen</p>
  <p class="wert">{value ? lageText(value) : 'Bitte auswählen'}</p>
</div>

<style>
  .ziffernblatt-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .ziffernblatt {
    width: 100%;
    max-width: 260px;
    touch-action: manipulation;
  }

  .sektor {
    fill: var(--card);
    stroke: var(--line);
    stroke-width: 1;
    cursor: pointer;
  }

  .sektor.aktiv {
    fill: var(--navy);
  }

  .sektor-label {
    font-size: 18px;
    font-weight: 600;
    fill: var(--ink);
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
  }

  .sektor-label.aktiv {
    fill: #fff;
  }

  .mitte {
    fill: var(--navy-soft);
    stroke: var(--line);
    stroke-width: 1;
    cursor: pointer;
  }

  .mitte.aktiv {
    fill: var(--magenta);
  }

  .mitte-label {
    font-size: 20px;
    font-weight: 700;
    fill: var(--navy);
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
  }

  .mitte-label.aktiv {
    fill: #fff;
  }

  .hinweis {
    font-size: 13px;
    color: var(--muted);
  }

  .wert {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
  }
</style>
