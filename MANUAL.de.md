# NOAA Storms – Benutzerhandbuch

## 1. Zweck und Grenzen

NOAA Storms überwacht die von NOAA/NHC veröffentlichten aktiven tropischen
Wirbelstürme. Das Signal-K-Plugin berechnet Entfernung und Peilung relativ zur
Schiffsposition und kann zu jedem aktiven Sturm eine GPX-Vorhersagedatei
erzeugen.

Die Daten sind eine Planungshilfe. Sie ersetzen weder offizielle Warnungen noch
Seemannschaft, Wetterberatung oder eine sichere Navigationsentscheidung. Eine
erzeugte Vorhersagespur ist keine empfohlene Schiffsroute.

## 2. Bestandteile

Das Projekt besteht aus:

- dem Signal-K-Plugin als alleiniger Stelle für Konfiguration und Validierung,
- einer reinen Anzeige-WebApp,
- dem optionalen GPX-Export,
- einer optionalen, sicher begrenzten GPX-Bereinigung.

Die WebApp verändert keine Einstellungen. Ihre Konfigurationslinks führen zur
Plugin-Konfiguration in der Signal-K-Administration.

## 3. Installation und Aktivierung

### Installation über den Appstore

NOAA Storms im Signal K Appstore auswählen und installieren.

### Manuelle Installation

```bash
cd ~/.signalk
npm install noaa-storms
```

Danach:

1. Signal K Admin öffnen.
2. **Server → Plugin Config → NOAA Storms** wählen.
3. Plugin aktivieren.
4. Gewünschte Werte einstellen und speichern.
5. NOAA Storms im Anwendungsmenü öffnen.

## 4. Konfiguration

### Data mode

- `live`: Ruft Daten von der konfigurierten NOAA-URL ab.
- `test`: Erzeugt simulierte Stürme zum Prüfen von Anzeige und Schwellenwerten.

Im Testmodus zeigt die WebApp unübersehbar `TEST DATA ACTIVE`. Der Testmodus
schreibt und löscht keine Live-GPX-Dateien.

### NOAA URL

Standard:

```text
https://www.nhc.noaa.gov/CurrentStorms.json
```

Die URL sollte nur geändert werden, wenn eine kompatible Datenquelle verwendet
wird. Die Antwort muss ein Array `activeStorms` enthalten.

### Warn- und Alarmschwellen

- **Warning threshold**: Entfernung, ab der der Zustand `warning` gilt.
- **Alarm threshold**: kleinere Entfernung, ab der der Zustand `alarm` gilt.

Die Alarmschwelle darf nicht größer als die Warnschwelle sein. Ungültige Werte
werden durch sichere Standardwerte ersetzt.

### Signal-K-Notifications

**Enable Signal K notifications** bestimmt, ob das Plugin Warnungen und Alarme
unter `notifications.noaaHurricane.nearest` veröffentlicht. Die Funktion ist
standardmäßig ausgeschaltet.

Bei aktiviertem Schalter gilt:

- Warnbereich: `state: "warn"`
- Alarmbereich: `state: "alarm"`
- Normalzustand oder kein aktiver Sturm: Der Notification-Pfad wird mit `null`
  entfernt; es wird keine normale visuelle oder akustische Meldung erzeugt.

Wird eine bereits aktive Sturmwarnung durch eine unzuverlässige Schiffsposition
nicht mehr neu berechenbar, bleibt ihre bisherige Warnstufe erhalten. Die
Meldung weist dann auf die fehlende Entfernung hin und fordert nur eine
visuelle Darstellung an.

#### Verhalten nach einem Plugin-Update

Signal K öffnet nach einem Plugin-Update keinen automatischen Einstellungsdialog.
Fehlt die gespeicherte Auswahl, behandelt NOAA Storms Notifications deshalb als
deaktiviert und entfernt eine möglicherweise von der Vorversion zurückgelassene
Notification. Die WebApp zeigt gleichzeitig einen auffälligen Hinweis mit Link
zur Plugin-Konfiguration.

Der Hinweis verschwindet, sobald der Benutzer **Enable Signal K notifications**
bewusst ein- oder ausschaltet und die Plugin-Konfiguration speichert. Damit
wird eine alte Installation nicht stillschweigend weiter alarmieren, während
die Entscheidung des Benutzers dauerhaft erhalten bleibt.

### Abrufintervalle

- **Poll normal**: Intervall außerhalb der Warnbereiche.
- **Poll warning**: Intervall im Warnzustand.
- **Poll alarm**: Intervall im Alarmzustand.

Alle Werte werden in Minuten angegeben.

### GPX-Einstellungen

- **Record GPX files** aktiviert die Erzeugung.
- **GPX output directory** ist ein absoluter Verzeichnispfad.
- **Delete GPX files when storms are no longer listed** aktiviert die sichere
  Bereinigung inaktiver, vom Plugin verwalteter Dateien.

Das Plugin erstellt das Ausgabeverzeichnis bei Bedarf. Der Pfad wird in der
WebApp aus Datenschutz- und Sicherheitsgründen nicht vollständig angezeigt.

## 5. WebApp verstehen

Die Statuskarten zeigen Laufzeitzustand, Datenquelle, letzte und nächste
NOAA-Abfrage, Abrufintervall, Schiffsposition sowie die wirksame Konfiguration.

Die Entfernung zum Sturm wird nur als zuverlässig behandelt, wenn eine gültige
und ausreichend aktuelle Position aus `navigation.position` vorliegt. Bei
fehlender, veralteter oder verdächtiger Position zeigt die WebApp den Grund an,
statt eine möglicherweise gefährlich falsche Entfernung darzustellen.

Für jeden gültigen aktiven Sturm werden Name, Klassifikation, NOAA-Position,
Aktualisierungszeit, Intensität, Bewegung, Entfernung, Peilung und GPX-Status
angezeigt.

## 6. GPX-Dateien

### Dateiname und Aktualisierung

Für jeden Sturm wird eine stabile, aus der NOAA-ID gebildete Datei verwaltet:

```text
noaa-storms-<storm-id>-current.gpx
```

Eine Datei wird nur neu geschrieben, wenn NOAA ein neues Forecast Advisory
veröffentlicht. Das Schreiben erfolgt zunächst in eine temporäre Datei und
anschließend per atomarer Umbenennung. Ein abgebrochener Schreibvorgang ersetzt
somit keine gültige Datei durch eine Teildatei.

### Inhalt

Die GPX-Datei enthält:

- `STURMNAME START` an der aktuellen Advisory-Position,
- Zeit, Klassifikation, Wind, Druck, Bewegung und Advisory-Nummer, soweit
  vorhanden,
- Vorhersagewegpunkte mit Gültigkeitszeit und Windwerten,
- einen Track vom Startpunkt durch alle nutzbaren Vorhersagepunkte,
- einen Link zum NOAA Forecast Advisory.

Bei Hurricanes verwendet der Startpunkt in OpenCPN:

- `Weather-Hurricane-NH` auf der Nordhalbkugel,
- `Weather-Hurricane-SH` auf der Südhalbkugel.

Andere Anwendungen können unbekannte Symbole ignorieren, ohne die übrigen
GPX-Daten unbrauchbar zu machen.

### Bedeutung der GPX-Statuswerte

| Status | Bedeutung |
|---|---|
| `written` | Datei wurde geschrieben oder ist bereits aktuell |
| `waiting` | Forecast Advisory oder nutzbare Vorhersagepunkte fehlen noch |
| `skipped` | Export ist deaktiviert, nicht konfiguriert oder im Testmodus gesperrt |
| `error` | Abruf, Validierung oder Schreiben ist fehlgeschlagen |

## 7. Verwendung in OpenCPN

Das Plugin legt nur GPX-Dateien ab. Es bestimmt nicht, wie OpenCPN sie
importiert. Der Benutzer kann eine Datei je nach gewünschter Arbeitsweise als
Layer, Track oder Route laden.

Layer gruppieren die enthaltenen Wegpunkte und den Track als nicht direkt
editierbares Objekt. OpenCPN unterscheidet temporäre und dauerhafte Layer.

Wer GPX-Dateien direkt in OpenCPNs `layers`-Verzeichnis ablegt, erzeugt damit
dauerhafte Layer. OpenCPN liest neue oder geänderte Dateien in diesem
Verzeichnis normalerweise erst beim Neustart ein. Eine auf der Festplatte
gelöschte Datei kann deshalb bis zum Neustart weiterhin in der laufenden
OpenCPN-Sitzung sichtbar sein.

Die GPX-Datei enthält einen Track. OpenCPN oder andere Programme können Inhalte
je nach Importfunktion auch als Track oder Route übernehmen. Der Benutzer trägt
die Verantwortung für die gewählte Importart. Der NOAA-Forecasttrack ist nicht
als zu fahrende Route gedacht.

## 8. Sichere Bereinigung

Ist die Bereinigung aktiviert, wird eine GPX-Datei nur entfernt, wenn:

1. eine erfolgreiche und strukturell gültige NOAA-Liveantwort vorliegt,
2. die Sturm-ID nicht mehr in `activeStorms` enthalten ist,
3. das Plugin die Datei in `.noaa-storms-files.json` als eigene Datei kennt,
4. der Dateiname dem verwalteten NOAA-Storms-Schema entspricht,
5. die Datei direkt im konfigurierten Ausgabeverzeichnis liegt.

Fremde GPX-Dateien werden nicht gelöscht. Abruf- oder Parsingfehler lösen keine
Bereinigung aus. Im Testmodus findet keine Live-Bereinigung statt.

## 9. Typische Fehlerbilder

### Ein alter Sturm ist in OpenCPN sichtbar

Prüfen:

1. Ist die automatische Bereinigung aktiviert?
2. Ist die alte GPX-Datei noch im Ausgabeverzeichnis vorhanden?
3. Wurde OpenCPN seit der Bereinigung neu gestartet oder der Layer entladen?

Eine entfernte Datei verschwindet nicht zwingend sofort aus einer laufenden
OpenCPN-Sitzung.

### Ein neuer Sturm fehlt in OpenCPN

In der WebApp den GPX-Status des Sturms prüfen:

- `written`: Datei existiert; OpenCPN muss sie gegebenenfalls neu laden.
- `waiting`: NOAA liefert noch keine nutzbaren Forecastpunkte.
- `skipped`: GPX-Konfiguration prüfen.
- `error`: Fehlermeldung und Schreibrechte des Zielverzeichnisses prüfen.

Liegt das Ziel im OpenCPN-`layers`-Verzeichnis, kann ein Neustart erforderlich
sein, bevor die neue Datei als Layer erscheint.

### Entfernung oder Peilung fehlt

Die WebApp zeigt den Grund im Feld **Distance status**. Häufige Ursachen sind
eine fehlende, zeitlich veraltete oder ungültige Signal-K-Schiffsposition.

### Keine GPX-Datei wird erzeugt

Prüfen:

- Live-Modus aktiv,
- **Record GPX files** eingeschaltet,
- absoluter Ausgabepfad gesetzt,
- Signal-K-Prozess besitzt Schreibrechte,
- NOAA-Sturm besitzt ein Forecast Advisory,
- WebApp meldet keinen Parser- oder Schreibfehler.

## 10. Datenschutz und Betriebssicherheit

- Die WebApp veröffentlicht den vollständigen GPX-Ausgabepfad nicht.
- GPX-Dateien enthalten Sturm- und Forecastpositionen, nicht die
  Schiffsposition.
- Änderungen an Konfiguration, Importart und Dateiaufbewahrung bleiben unter
  Kontrolle des Benutzers.
- Vor Änderungen an einem produktiven Navigationssystem sollten bestehende
  Dateien und Einstellungen gesichert werden.

## 11. Schnittstellen

```text
/plugins/noaa-storms/status
/plugins/noaa-storms/data
```

Das Plugin liest die Schiffsposition aus `navigation.position`.

## 12. Supportinformationen

Für eine nachvollziehbare Fehlermeldung sind Pluginversion, Datenmodus,
GPX-Status, Zeitpunkt der letzten erfolgreichen NOAA-Abfrage, Betriebssystem,
OpenCPN-Version, gewählte Importart und relevante Signal-K-Protokollzeilen
hilfreich. Zugangsdaten und private Dateipfade sollten nicht veröffentlicht
werden.
