# NOAA Storms

NOAA Storm Monitor plugin and display-only WebApp for Signal K.

Deutsch: [README.de.md](README.de.md) · German user manual: [MANUAL.de.md](MANUAL.de.md)

## Features

- Fetches active tropical cyclones from NOAA `CurrentStorms.json`
- Displays runtime, vessel, storm, warning, alarm, and GPX status in Signal K
- Calculates distance and bearing from the vessel to each storm
- Uses normal, warning, and alarm polling intervals
- Supports live and clearly marked test data
- Optionally writes OpenCPN-compatible GPX 1.1 forecast tracks
- Safely cleans up only GPX files proven to have been created by the plugin

## Installation

### Signal K Appstore

Install NOAA Storms from the Signal K Appstore when available.

### Manual installation

```bash
cd ~/.signalk
npm install noaa-storms
```

## Activation

1. Open the Signal K Admin UI.
2. Go to **Server → Plugin Config → NOAA Storms**.
3. Enable and configure the plugin.
4. Open the NOAA Storms WebApp from the Signal K applications menu.

## WebApp

The WebApp is display-only. It shows:

- Runtime and polling state
- NOAA data source
- Last and next request
- Vessel position and source
- Active storms and their NOAA update times
- Distance, bearing, warning, and alarm state
- Effective plugin configuration
- Per-storm GPX export status

All user-editable settings remain in the Signal K plugin configuration. Links
in the WebApp open the relevant configuration page.

## Configuration

| Parameter | Default |
|---|---:|
| Data mode | `live` |
| NOAA URL | `https://www.nhc.noaa.gov/CurrentStorms.json` |
| Warning threshold | 500 nm |
| Alarm threshold | 250 nm |
| Enable Signal K notifications | disabled |
| Normal polling interval | 720 min |
| Warning polling interval | 60 min |
| Alarm polling interval | 15 min |
| Record GPX files | disabled |
| GPX output directory | empty |
| Delete inactive storm GPX files | disabled |

The backend validates all settings and applies safe defaults. The GPX output
directory must be an absolute path.

### Signal K notifications

Notifications are opt-in. When enabled, the plugin publishes `warn` and
`alarm` states under `notifications.noaaHurricane.nearest`. A normal condition
is represented by removing that notification with a `null` value; normal never
requests visual or sound output.

After upgrading from a version that emitted notifications automatically, open
the plugin configuration and explicitly save the desired setting. Until that
choice is saved, notifications remain disabled, any legacy notification is
cleared, and the WebApp displays a configuration reminder.

## OpenCPN-compatible GPX export

Enable **Record GPX files** and configure an absolute **GPX output directory**
to write one current file per active NOAA storm:

```text
noaa-storms-<storm-id>-current.gpx
```

The configured directory is deliberately application-neutral. Users may import
the generated GPX file into OpenCPN as a layer, track, or route, or use it with
another GPX-compatible application. Placing a file directly in OpenCPN's
`layers` directory makes it a persistent layer; OpenCPN may require a restart
before additions, updates, or deletions become visible.

Each GPX file contains:

- A `STORM START` waypoint at the current advisory position
- OpenCPN's hemisphere-specific hurricane symbol for hurricanes
- Forecast waypoints with validity time, maximum wind, gusts, and advisory
- A forecast track beginning at the current advisory position
- NOAA source links and informational descriptions

The file is an informational storm forecast, not a vessel route and not a
substitute for official warnings or safe navigation practice.

Files are refreshed only for a new NOAA forecast advisory. The WebApp reports
whether each active storm was written, is current, is waiting for usable
forecast data, was skipped by configuration, or encountered a write error.

When **Delete GPX files when storms are no longer listed** is enabled, cleanup
runs only after a successful, valid live NOAA response. The plugin tracks its
own files in `.noaa-storms-files.json`, deletes only managed files inside the
configured output directory, and never performs live cleanup in test mode.
Writes use a temporary file and atomic rename so a partial update cannot replace
a valid GPX file.

## NOAA data source

The default source is:

`https://www.nhc.noaa.gov/CurrentStorms.json`

The URL can be changed in the plugin configuration. The effective source is
shown as a link in the WebApp.

## Test data mode

Test mode creates simulated storms relative to the available vessel position.
It is intended for UI, threshold, and notification testing without depending on
NOAA connectivity. The WebApp prominently displays `TEST DATA ACTIVE`.

Test mode does not write or delete live GPX files.

## API endpoints

- `/plugins/noaa-storms/status`
- `/plugins/noaa-storms/data`

Compatibility aliases without the `/plugins` prefix are also registered.

## Signal K integration

The plugin reads the vessel position from:

- `navigation.position`

It publishes its runtime data through Signal K and can optionally publish a
nearest-storm notification.

## Development

This project was designed and developed by its maintainer with assistance from
OpenAI Codex.

AI-assisted contributions are reviewed and validated by the maintainer, who
remains responsible for the project's functionality, security, and
maintenance.

Run the local checks with:

```bash
npm run check
npm test
npm run pack-test
```

## Project structure

```text
noaa-storms/
├── index.js
├── gpx.js
├── package.json
├── README.md
├── README.de.md
├── MANUAL.de.md
├── public/
│   ├── index.html
│   └── NOAA_noText_logo.svg
└── test/
    ├── config.test.js
    └── gpx.test.js
```

## License

MIT License
