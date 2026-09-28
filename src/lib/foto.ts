const MAX_KANTE = 1600;
const JPEG_QUALITAET = 0.8;

export async function komprimiereFoto(datei: File): Promise<{ blob: Blob; breite: number; hoehe: number }> {
  const bitmap = await createImageBitmap(datei, { imageOrientation: 'from-image' });

  const skalierung = Math.min(1, MAX_KANTE / Math.max(bitmap.width, bitmap.height));
  const breite = Math.round(bitmap.width * skalierung);
  const hoehe = Math.round(bitmap.height * skalierung);

  const canvas = document.createElement('canvas');
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar');
  ctx.drawImage(bitmap, 0, 0, breite, hoehe);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITAET));
  if (!blob) throw new Error('Foto konnte nicht komprimiert werden');

  return { blob, breite, hoehe };
}
