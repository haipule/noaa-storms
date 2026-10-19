# NOAA Storms

NOAA-Sturmmonitor als Signal-K-Plugin mit einer reinen Anzeige-WebApp.

English: [README.md](README.md) · Ausführliches Handbuch: [MANUAL.de.md](MANUAL.de.md)

## Funktionen

- Ruft aktive tropische Wirbelstürme aus NOAA `CurrentStorms.json` ab
- Zeigt Laufzeit-, Schiffs-, Sturm-, Warn-, Alarm- und GPX-Status in Signal K
- Berechnet Entfernung und Peilung vom Schiff zu jedem Sturm
- Verwendet unterschiedliche Abrufintervalle für Normal-, Warn- und Alarmzustand
- Unterstützt Livebetrieb und deutlich gekennzeichnete Testdaten
- Erzeugt optional OpenCPN-kompatible GPX-1.1-Vorhersagespuren
- Löscht ausschließlich nachweislich vom Plugin erzeugte GPX-Dateien

## Installation

### Signal K Appstore

NOAA Storms aus dem Signal K Appstore installieren, sobald es dort verfügbar ist.

### Manuelle Installation

```bash
cd ~/.signalk
npm install noaa-storms
```

## Aktivierung

1. Die Signal-K-Administration öffnen.
2. **Server → Plugin Config → NOAA Storms** aufrufen.
3. Das Plugin aktivieren und konfigurieren.
4. Die NOAA-Storms-WebApp über das Signal-K-Anwendungsmenü öffnen.

## Konfiguration

Alle veränderbaren Einstellungen befinden sich ausschließlich in der
Signal-K-Plugin-Konfiguration. Die WebApp zeigt nur die wirksamen Werte und den
Laufzeitstatus an.

| Parameter | Standardwert |
|---|---:|
| Datenmodus | `live` |
| NOAA-URL | `https://www.nhc.noaa.gov/CurrentStorms.json` |
| Warnschwelle | 500 sm |
| Alarmschwelle | 250 sm |
| Signal-K-Notifications aktivieren | aus |
| Normales Abrufintervall | 720 min |
| Abrufintervall bei Warnung | 60 min |
| Abrufintervall bei Alarm | 15 min |
| GPX-Dateien aufzeichnen | aus |
| GPX-Ausgabeverzeichnis | leer |
| GPX-Dateien inaktiver Stürme löschen | aus |

Das GPX-Ausgabeverzeichnis muss ein absoluter Pfad sein.

### Signal-K-Notifications

Notifications sind standardmäßig ausgeschaltet. Sind sie aktiviert,
veröffentlicht das Plugin `warn` und `alarm` unter
`notifications.noaaHurricane.nearest`. Im Normalzustand wird eine bestehende
Notification mit `null` entfernt; `normal` fordert weder eine visuelle noch
eine akustische Ausgabe an.

Nach einem Update von einer Version mit automatisch aktiven Notifications muss
der Benutzer die gewünschte Einstellung einmal ausdrücklich öffnen und
speichern. Bis dahin bleiben Notifications aus, eine alte Notification wird
entfernt und die WebApp zeigt einen Konfigurationshinweis.

## GPX-Export

Bei aktiviertem GPX-Export erzeugt das Plugin pro aktivem Sturm eine Datei:

```text
noaa-storms-<storm-id>-current.gpx
```

Das Zielverzeichnis ist absichtlich nicht auf OpenCPN festgelegt. Der Benutzer
kann die Datei nach Bedarf als Layer, Track oder Route importieren oder in einer
anderen GPX-fähigen Anwendung verwenden.

Eine Datei enthält den Wegpunkt `STURMNAME START`, Vorhersagewegpunkte und eine
Vorhersagespur. Hurricanes erhalten in OpenCPN das passende Symbol für die
Nord- oder Südhalbkugel. Die Daten dienen ausschließlich der Information und
sind keine Navigationsroute.

Die optionale Bereinigung entfernt nur Dateien aus dem eigenen Manifest
`.noaa-storms-files.json`, nur innerhalb des konfigurierten Verzeichnisses und
nur nach einer erfolgreichen, gültigen NOAA-Liveantwort. Im Testmodus werden
keine Live-GPX-Dateien geschrieben oder gelöscht.

Weitere Bedienungs-, OpenCPN- und Fehlerdiagnosehinweise stehen im
[deutschen Handbuch](MANUAL.de.md).

## API-Endpunkte

- `/plugins/noaa-storms/status`
- `/plugins/noaa-storms/data`

## Entwicklung

Dieses Projekt wurde von seinem Maintainer mit Unterstützung von OpenAI Codex
entworfen und entwickelt.

KI-unterstützte Beiträge werden vom Maintainer geprüft und validiert. Er bleibt
für Funktion, Sicherheit und Wartung des Projekts verantwortlich.

Lokale Prüfungen:

```bash
npm run check
npm test
npm run pack-test
```

## Lizenz

MIT-Lizenz
