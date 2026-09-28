export function heuteIso(): string {
  const jetzt = new Date();
  const tzOffsetMs = jetzt.getTimezoneOffset() * 60_000;
  return new Date(jetzt.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export function formatDeutsch(isoDatum: string): string {
  const [jahr, monat, tag] = isoDatum.split('-');
  if (!jahr || !monat || !tag) return isoDatum;
  return `${tag}.${monat}.${jahr}`;
}
