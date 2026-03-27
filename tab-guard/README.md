# Tab Guard by Match2AD

**Nie wieder Tabs verlieren.** Tab Guard sichert automatisch alle offenen Browser-Fenster und Tabs und stellt sie nach Abstürzen, versehentlichem Schließen oder Neustarts wieder her.

Entwickelt von [Match2AD](https://www.match2ad.de).

---

## Features

- **Automatisches Speichern** — Alle offenen Fenster und Tabs werden bei jeder Änderung gesichert
- **Sofortige Wiederherstellung** — Einzelne Tabs, ganze Fenster oder komplette Sessions wiederherstellen
- **30-Tage-History** — Vollständige Übersicht aller gespeicherten Tab-Sitzungen
- **Dashboard** — Durchsuchbare Timeline mit Tagesgruppierung
- **Datenschutz** — Alles bleibt lokal, kein Netzwerkzugriff, Inkognito-Tabs werden ignoriert
- **Leichtgewichtig** — Kein Framework, kein Build-Step, minimale Berechtigungen

## Installation

### Aus dem Quellcode (Entwicklermodus)

1. **Repository klonen:**
   ```bash
   git clone https://github.com/match2ad/tab-guard.git
   ```

2. **Chrome öffnen** und zu `chrome://extensions/` navigieren

3. **Entwicklermodus** aktivieren (Schalter oben rechts)

4. **"Entpackte Erweiterung laden"** klicken und den `tab-guard/` Ordner auswählen

5. **Fertig!** Tab Guard erscheint in der Toolbar. Klicke auf das Icon, um das Popup zu öffnen.

## Verwendung

### Popup (Schnellzugriff)

Klicke auf das Tab Guard Icon in der Chrome-Toolbar:

- **Aktiv** — Zeigt alle aktuell offenen Fenster mit aufklappbaren Tab-Listen
- **Geschlossen** — Kürzlich geschlossene Fenster und Tabs mit Wiederherstellen-Button
- **History** — Link zum vollständigen Dashboard

### Dashboard (Vollansicht)

Öffne das Dashboard über den Link im Popup oder über die Extension-Seite:

- **Timeline** — Alle gespeicherten Sessions gruppiert nach Tagen
- **Suche** — Filtere nach Tab-Titel oder URL
- **Speicherinfo** — Aktueller Speicherverbrauch
- **History löschen** — Gesamte History entfernen

## Wie es funktioniert

Tab Guard nutzt einen Service Worker, der auf Chrome-Events reagiert:

| Event | Aktion |
|-------|--------|
| Tab geschlossen | Fenster-Snapshot aktualisieren |
| Tab-URL/Titel geändert | Fenster-Snapshot aktualisieren |
| Fenster geschlossen | In geschlossene Liste speichern |
| Chrome gestartet | Fehlende Fenster erkennen |
| Täglich | Einträge älter als 30 Tage entfernen |

Schnelle aufeinanderfolgende Änderungen (z.B. mehrere Tabs auf einmal schließen) werden gebündelt (2s Debouncing), um die Speicher-Performance zu optimieren.

## Berechtigungen

| Berechtigung | Verwendung |
|-------------|------------|
| `tabs` | Tab-URLs, Titel und Favicons lesen |
| `storage` | Snapshots lokal speichern |
| `alarms` | Täglicher Cleanup alter Einträge |

**Kein Netzwerkzugriff.** Keine Host-Permissions. Alle Daten bleiben auf deinem Gerät.

## Technologie

- Chrome Extension Manifest V3
- Vanilla JavaScript (ES Modules)
- Keine externen Abhängigkeiten
- Kein Build-Step erforderlich

## Projektstruktur

```
tab-guard/
├── manifest.json              # Extension-Konfiguration
├── src/
│   ├── background.js          # Service Worker (Event-Listener, Snapshots)
│   ├── storage.js             # Storage-Abstraction (chrome.storage.local)
│   ├── utils.js               # Hilfsfunktionen (ID, Zeitformat, Dedup)
│   ├── dom.js                 # Sichere DOM-Helpers
│   ├── popup/                 # Popup-UI (400x520px)
│   └── dashboard/             # Dashboard-UI (Vollseite)
├── icons/                     # Extension-Icons
└── tests/                     # Unit-Tests (43 Tests)
```

## Tests

```bash
node tests/utils.test.js       # 15 Tests
node tests/storage.test.js     # 17 Tests
node tests/background.test.js  # 11 Tests
```

## Lizenz

MIT License

Copyright (c) 2026 Match2AD - www.match2ad.de
