<script lang="ts">
  import type { Lage } from '../lib/model';
  import { tuerSegment, segmentMitte } from '../lib/tuer';
  import { lageText } from '../lib/lage';

  let { value = $bindable(null) }: { value: Lage | null } = $props();

  const breite = 170;
  const hoehe = 250;
  const rahmen = 42;
  const zahlen: Lage[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const mSeg = tuerSegment('M', breite, hoehe, rahmen);
  const mMitte = segmentMitte(mSeg);

  function waehlen(lage: Lage) {
    value = lage;
  }
</script>

<div class="tuer-wrapper">
  <svg viewBox={`0 0 ${breite} ${hoehe}`} class="tuer">
    {#each zahlen as n (n)}
      {@const seg = tuerSegment(n, breite, hoehe, rahmen)}
      {@const mitte = segmentMitte(seg)}
      <rect
        x={seg.x}
        y={seg.y}
        width={seg.breite}
        height={seg.hoehe}
        class="segment"
        class:aktiv={value === n}
        role="button"
        tabindex="0"
        aria-label={`${n} Uhr`}
        onclick={() => waehlen(n)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && waehlen(n)}
      />
      <text x={mitte.x} y={mitte.y} class="segment-label" class:aktiv={value === n}>{n}</text>
    {/each}
    <rect
      x={mSeg.x}
      y={mSeg.y}
      width={mSeg.breite}
      height={mSeg.hoehe}
      class="mitte"
      class:aktiv={value === 'M'}
      role="button"
      tabindex="0"
      aria-label="generell"
      onclick={() => waehlen('M')}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && waehlen('M')}
    />
    <text x={mMitte.x} y={mMitte.y} class="mitte-label" class:aktiv={value === 'M'}>M</text>
  </svg>
  <p class="hinweis">Ansicht von außen nach innen</p>
  <p class="wert">{value ? lageText(value) : 'Bitte auswählen'}</p>
</div>

<style>
  .tuer-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .tuer {
    width: 100%;
    max-width: 200px;
    touch-action: manipulation;
  }

  .segment {
    fill: var(--card);
    stroke: var(--line);
    stroke-width: 1;
    cursor: pointer;
  }

  .segment.aktiv {
    fill: var(--navy);
  }

  .segment-label {
    font-size: 16px;
    font-weight: 600;
    fill: var(--ink);
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
  }

  .segment-label.aktiv {
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
