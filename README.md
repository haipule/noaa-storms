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
| Warning threshold | 400 nm |
| Alarm threshold | 240 nm |
| Poll normal | 720 min |
| Poll warning | 60 min |
| Poll alarm | 15 min |

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
