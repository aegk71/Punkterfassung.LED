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
