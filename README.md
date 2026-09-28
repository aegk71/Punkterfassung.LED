# Punkterfassung (LETHE)

Mobile PWA zur Erfassung von Arbeitspunkten an Türanlagen an Bord von Yachten.
Konzept und Anforderungen: [Anweisung_mobile_pwa.md](./Anweisung_mobile_pwa.md).

Einzelnutzer, offline-fähig, alle Daten lokal auf dem Gerät (IndexedDB). Kein Backend.

## Entwicklung

```
npm install
npm run dev
```

## Build

```
npm run build
npm run preview
```

Deploy erfolgt automatisch über GitHub Actions auf GitHub Pages bei Push auf `main`.
