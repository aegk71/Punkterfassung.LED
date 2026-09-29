// Fotos aus der IndexedDB lassen sich in Safari/WebKit manchmal nicht lesen
// ("An error occured reading the Blob argument", "The object can not be found
// here.") – vermutlich verwirft iOS unter Speicherdruck die Ablagedatei hinter
// dem Blob. Neuaufbau über arrayBuffer() mit ein paar Wiederholversuchen behebt
// das in den meisten Fällen.
export async function blobSicherLesen(blob: Blob, versuche = 3): Promise<Blob> {
  let letzterFehler: unknown;
  for (let i = 0; i < versuche; i++) {
    try {
      const buffer = await blob.arrayBuffer();
      return new Blob([buffer], { type: blob.type || 'image/jpeg' });
    } catch (err) {
      letzterFehler = err;
      if (i < versuche - 1) await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1)));
    }
  }
  throw letzterFehler instanceof Error ? letzterFehler : new Error('Foto konnte nicht gelesen werden.');
}

export function blobZuDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function bildLaden(url: string): Promise<{ dataUrl: string; breite: number; hoehe: number }> {
  const antwort = await fetch(url);
  const blob = await antwort.blob();
  const dataUrl = await blobZuDataUrl(blob);
  const bitmap = await createImageBitmap(blob);
  const breite = bitmap.width;
  const hoehe = bitmap.height;
  bitmap.close();
  return { dataUrl, breite, hoehe };
}
