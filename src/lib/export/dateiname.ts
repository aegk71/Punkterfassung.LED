export function dateinameTeil(text: string): string {
  return text
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_');
}

export function exportDateiname(projektNr: string, vorgang: string, heuteIso: string, endung: string): string {
  return `${dateinameTeil(projektNr)}_${dateinameTeil(vorgang)}_Punkte_${heuteIso}.${endung}`;
}
