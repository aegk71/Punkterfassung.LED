export interface PfeilKoordinaten {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export async function pfeilInBildRendern(blob: Blob, pfeil: PfeilKoordinaten): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const x1 = pfeil.x1 * canvas.width;
  const y1 = pfeil.y1 * canvas.height;
  const x2 = pfeil.x2 * canvas.width;
  const y2 = pfeil.y2 * canvas.height;

  const strichstaerke = Math.max(canvas.width, canvas.height) * 0.012;

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = strichstaerke * 1.8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = '#E30613';
  ctx.lineWidth = strichstaerke;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const winkel = Math.atan2(y2 - y1, x2 - x1);
  const spitzenLaenge = strichstaerke * 4.5;
  const spitzenBreite = strichstaerke * 3.2;
  const basisX = x2 - spitzenLaenge * Math.cos(winkel);
  const basisY = y2 - spitzenLaenge * Math.sin(winkel);
  const seitenWinkel = Math.PI / 2;
  const s1x = basisX + (spitzenBreite / 2) * Math.cos(winkel + seitenWinkel);
  const s1y = basisY + (spitzenBreite / 2) * Math.sin(winkel + seitenWinkel);
  const s2x = basisX + (spitzenBreite / 2) * Math.cos(winkel - seitenWinkel);
  const s2y = basisY + (spitzenBreite / 2) * Math.sin(winkel - seitenWinkel);

  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(s1x, s1y);
  ctx.lineTo(s2x, s2y);
  ctx.closePath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = strichstaerke * 0.6;
  ctx.stroke();
  ctx.fillStyle = '#E30613';
  ctx.fill();

  const ergebnis = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!ergebnis) throw new Error('Bild mit Pfeil konnte nicht gerendert werden');
  return ergebnis;
}
