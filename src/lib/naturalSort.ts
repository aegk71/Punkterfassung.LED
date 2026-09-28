export function naturalCompare(a: string, b: string): number {
  const teileA = a.match(/(\d+|\D+)/g) ?? [a];
  const teileB = b.match(/(\d+|\D+)/g) ?? [b];
  const laenge = Math.max(teileA.length, teileB.length);

  for (let i = 0; i < laenge; i++) {
    const ta = teileA[i] ?? '';
    const tb = teileB[i] ?? '';
    const na = Number(ta);
    const nb = Number(tb);
    const istZahlA = ta !== '' && !Number.isNaN(na);
    const istZahlB = tb !== '' && !Number.isNaN(nb);

    if (istZahlA && istZahlB) {
      if (na !== nb) return na - nb;
    } else {
      const vergleich = ta.localeCompare(tb);
      if (vergleich !== 0) return vergleich;
    }
  }
  return 0;
}
