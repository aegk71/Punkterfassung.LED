<script lang="ts">
  type Pfeil = { x1: number; y1: number; x2: number; y2: number };
  type Punkt2D = { x: number; y: number };

  let { url, breite, hoehe, pfeil, onSchliessen, onAktualisieren }: {
    url: string;
    breite: number;
    hoehe: number;
    pfeil: Pfeil | undefined;
    onSchliessen: () => void;
    onAktualisieren: (pfeil: Pfeil | undefined) => void;
  } = $props();

  let containerEl = $state<HTMLDivElement | null>(null);
  let zieht = $state(false);
  let startPx = $state<Punkt2D | null>(null);
  let aktuellPx = $state<Punkt2D | null>(null);

  function bildRect() {
    if (!containerEl) return null;
    const cw = containerEl.clientWidth;
    const ch = containerEl.clientHeight;
    if (cw === 0 || ch === 0) return null;
    const bildRatio = breite / hoehe;
    const containerRatio = cw / ch;
    let renderW: number;
    let renderH: number;
    if (bildRatio > containerRatio) {
      renderW = cw;
      renderH = cw / bildRatio;
    } else {
      renderH = ch;
      renderW = ch * bildRatio;
    }
    return { offsetX: (cw - renderW) / 2, offsetY: (ch - renderH) / 2, renderW, renderH };
  }

  function pxZuNormiert(px: Punkt2D): Punkt2D | null {
    const rect = bildRect();
    if (!rect) return null;
    return {
      x: Math.min(1, Math.max(0, (px.x - rect.offsetX) / rect.renderW)),
      y: Math.min(1, Math.max(0, (px.y - rect.offsetY) / rect.renderH)),
    };
  }

  function normiertZuPx(n: Punkt2D): Punkt2D | null {
    const rect = bildRect();
    if (!rect) return null;
    return { x: rect.offsetX + n.x * rect.renderW, y: rect.offsetY + n.y * rect.renderH };
  }

  function pointerDown(e: PointerEvent) {
    if (!containerEl) return;
    const box = containerEl.getBoundingClientRect();
    const px = { x: e.clientX - box.left, y: e.clientY - box.top };
    startPx = px;
    aktuellPx = px;
    zieht = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function pointerMove(e: PointerEvent) {
    if (!zieht || !containerEl) return;
    const box = containerEl.getBoundingClientRect();
    aktuellPx = { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  function pointerUp() {
    if (!zieht || !startPx || !aktuellPx) {
      zieht = false;
      return;
    }
    const n1 = pxZuNormiert(startPx);
    const n2 = pxZuNormiert(aktuellPx);
    zieht = false;
    if (!n1 || !n2) return;
    const distanz = Math.hypot(n2.x - n1.x, n2.y - n1.y);
    if (distanz < 0.02) return;
    onAktualisieren({ x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y });
  }

  let anzeigePfeilPx = $derived.by(() => {
    if (zieht && startPx && aktuellPx) return { start: startPx, ende: aktuellPx };
    if (pfeil) {
      const start = normiertZuPx({ x: pfeil.x1, y: pfeil.y1 });
      const ende = normiertZuPx({ x: pfeil.x2, y: pfeil.y2 });
      if (start && ende) return { start, ende };
    }
    return null;
  });
</script>

<div class="vollbild">
  <div class="vollbild-kopf">
    <button class="btn btn-secondary" onclick={onSchliessen}>Fertig</button>
    {#if pfeil}
      <button class="btn btn-secondary" onclick={() => onAktualisieren(undefined)}>Pfeil entfernen</button>
    {/if}
  </div>
  <div
    class="bild-bereich"
    role="application"
    aria-label="Foto mit Pfeil-Zeichenflaeche"
    bind:this={containerEl}
    onpointerdown={pointerDown}
    onpointermove={pointerMove}
    onpointerup={pointerUp}
    onpointercancel={pointerUp}
  >
    <img src={url} alt="" class="bild" draggable="false" />
    {#if anzeigePfeilPx}
      <svg class="pfeil-svg">
        <defs>
          <marker id="pfeil-spitze" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#E30613" />
          </marker>
        </defs>
        <line
          x1={anzeigePfeilPx.start.x}
          y1={anzeigePfeilPx.start.y}
          x2={anzeigePfeilPx.ende.x}
          y2={anzeigePfeilPx.ende.y}
          stroke="#fff"
          stroke-width="7"
          stroke-linecap="round"
        />
        <line
          x1={anzeigePfeilPx.start.x}
          y1={anzeigePfeilPx.start.y}
          x2={anzeigePfeilPx.ende.x}
          y2={anzeigePfeilPx.ende.y}
          stroke="#E30613"
          stroke-width="4"
          stroke-linecap="round"
          marker-end="url(#pfeil-spitze)"
        />
      </svg>
    {/if}
  </div>
  <p class="hinweis">Zum Zeichnen ziehen: Anfang antippen, zur Spitze ziehen.</p>
</div>

<style>
  .vollbild {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .vollbild-kopf {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  }

  .bild-bereich {
    position: relative;
    flex: 1 1 auto;
    touch-action: none;
    overflow: hidden;
  }

  .bild {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
  }

  .pfeil-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .hinweis {
    color: #fff;
    text-align: center;
    font-size: 13px;
    margin: 0;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  }
</style>
