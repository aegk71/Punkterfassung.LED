export function polarZuXY(cx: number, cy: number, r: number, winkelGrad: number): { x: number; y: number } {
  const rad = (winkelGrad * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

export function segmentPfad(
  cx: number,
  cy: number,
  innenR: number,
  aussenR: number,
  startGrad: number,
  endGrad: number,
): string {
  const p1 = polarZuXY(cx, cy, aussenR, startGrad);
  const p2 = polarZuXY(cx, cy, aussenR, endGrad);
  const p3 = polarZuXY(cx, cy, innenR, endGrad);
  const p4 = polarZuXY(cx, cy, innenR, startGrad);
  const grossbogen = endGrad - startGrad > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${aussenR} ${aussenR} 0 ${grossbogen} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innenR} ${innenR} 0 ${grossbogen} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}
