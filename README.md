# NOAA Storms

NOAA Storm Monitor Plugin + WebApp for Signal K

## Features

- Fetches active NOAA storms from `CurrentStorms.json`
- Integrated Signal K WebApp
- Dynamic warning and alarm levels
- Calculates:
  - Distance from vessel
  - Bearing
  - Storm movement
- Automatic polling intervals:
  - Normal
  - Warning
  - Alarm
- Supports live and test data mode
- Responsive dark-themed Web UI
- Reads vessel position from Signal K
- Combined Signal K plugin + WebApp
- Optional OpenCPN-compatible GPX forecast tracks
- Safe cleanup of GPX files for storms no longer listed by NOAA

---

## Installation

### Signal K Appstore

Install via the Signal K Appstore when available.

### Manual installation

```bash
cd ~/.signalk
npm install noaa-storms
````
---

## Activation

After installation:

1. Open Signal K Admin
2. Go to **Plugins → NOAA Storms**
3. Enable the plugin
4. The WebApp will appear in the sidebar menu

---

## WebApp

The WebApp displays:

- Runtime state
- NOAA data source
- Last and next poll
- Vessel position
- Storm overview
- Warning and alarm status
- Polling thresholds
- Live/Test data status

---

## Configuration

Default values:

| Parameter | Default |
|---|---|
| Warning threshold | 500 nm |
| Alarm threshold | 250 nm |
| Poll normal | 720 min |
| Poll warning | 60 min |
| Poll alarm | 15 min |
| Record GPX files | disabled |
| GPX output directory | empty |
| Delete inactive storm GPX files | disabled |

All settings are changed in the Signal K plugin configuration. The WebApp is
display-only and links back to the plugin configuration when a GPX setting
needs attention.

## OpenCPN GPX export

Enable **Record GPX files** and set **GPX output directory** to an absolute
filesystem path to write one
current file per active NOAA storm:

```text
noaa-storms-<storm-id>-current.gpx
```

Each GPX 1.1 file contains an official NOAA forecast track and informational
waypoints for the current and forecast positions. Forecast waypoint details
include the valid time, maximum wind, gusts, and advisory number. The current
position also includes the available classification, pressure, and movement
data. The GPX is an informational storm track, not a vessel route.

Files are refreshed only when NOAA publishes a new forecast advisory. The
WebApp shows whether each active storm's file was written, is current, is
waiting for forecast data, was skipped by configuration, or failed to write.
It displays the managed filename but not the configured filesystem path.

When **Delete GPX files when storms are no longer listed** is enabled, cleanup
runs only after a successful live NOAA response. The plugin records its files
in `.noaa-storms-files.json` and never deletes other GPX files from the output
directory. Test mode and failed NOAA requests do not trigger cleanup.

OpenCPN does not automatically reload an imported GPX file when it changes.
Files used as OpenCPN layers may require an OpenCPN restart before an update or
deletion becomes visible.

---

## NOAA Data Source

Default:

`https://www.nhc.noaa.gov/CurrentStorms.json`

The URL can be changed in the plugin configuration.

The WebApp displays the currently used source as a clickable link.

---

## Test Data Mode

In test mode, simulated storms are generated.

Purpose:

- Test alarms
- Test UI behavior
- Verify thresholds
- Operate without NOAA connectivity

The WebApp clearly displays:

`TEST DATA ACTIVE`

---

## API Endpoints

- `/plugins/noaa-storms/status`
- `/plugins/noaa-storms/data`

---

## Signal K Integration

Uses the following Signal K path:

- `navigation.position`

The vessel source is detected automatically.

---

## Project Structure

```text
noaa-storms/
├── index.js
├── package.json
├── public/
│   ├── index.html
│   └── NOAA_noText_logo.svg
````

---

## License

MIT License
