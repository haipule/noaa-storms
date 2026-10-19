const path = require("node:path");
const fs = require("node:fs/promises");

const MANIFEST_NAME = ".noaa-storms-files.json";
const FILE_PREFIX = "noaa-storms-";

function decodeHtml(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function extractAdvisoryText(body) {
  const source = String(body || "");
  const pre = source.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i);
  return decodeHtml(pre ? pre[1] : source).replace(/\r/g, "");
}

function coordinate(value, hemisphere) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return hemisphere === "S" || hemisphere === "W"
    ? -Math.abs(number)
    : Math.abs(number);
}

function forecastDate(issuance, day, hhmm) {
  const issued = new Date(issuance);
  if (Number.isNaN(issued.getTime())) return null;

  const hour = Number(hhmm.slice(0, 2));
  const minute = Number(hhmm.slice(2, 4));
  if (!Number.isInteger(hour) || hour > 23 || !Number.isInteger(minute) || minute > 59) {
    return null;
  }

  let candidate = new Date(Date.UTC(
    issued.getUTCFullYear(),
    issued.getUTCMonth(),
    Number(day),
    hour,
    minute
  ));

  if (candidate.getTime() < issued.getTime() - 6 * 60 * 60 * 1000) {
    candidate = new Date(Date.UTC(
      issued.getUTCFullYear(),
      issued.getUTCMonth() + 1,
      Number(day),
      hour,
      minute
    ));
  }

  return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString();
}

function parseForecastAdvisory(body, issuance) {
  const text = extractAdvisoryText(body);
  const pointPattern = /(?:FORECAST|OUTLOOK) VALID\s+(\d{2})\/(\d{4})Z\s+(\d+(?:\.\d+)?)([NS])\s+(\d+(?:\.\d+)?)([EW])\s*\nMAX WIND\s+(\d+) KT(?:\.\.\.GUSTS\s+(\d+) KT)?/g;
  const points = [];
  let match;

  while ((match = pointPattern.exec(text)) !== null) {
    const time = forecastDate(issuance, match[1], match[2]);
    const lat = coordinate(match[3], match[4]);
    const lon = coordinate(match[5], match[6]);
    if (!time || lat === null || lon === null) continue;

    points.push({
      time,
      lat,
      lon,
      maxWindKn: Number(match[7]),
      gustKn: match[8] ? Number(match[8]) : null
    });
  }

  return points;
}

function xml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function utcPointLabel(time) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "forecast";
  return `${String(date.getUTCDate()).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}Z`;
}

function pointDescription(storm, point) {
  const lines = [
    "NOAA forecast point",
    `Valid: ${point.time}`,
    `Maximum wind: ${point.maxWindKn} kn`
  ];
  if (Number.isFinite(point.gustKn)) lines.push(`Gusts: ${point.gustKn} kn`);
  if (storm.advisoryNumber) lines.push(`Advisory: ${storm.advisoryNumber}`);
  return lines.join("\n");
}

function startSymbol(storm) {
  if (String(storm?.category || "").toUpperCase() !== "HU") return "circle";
  return Number(storm?.stormLat) < 0
    ? "Weather-Hurricane-SH"
    : "Weather-Hurricane-NH";
}

function buildGpx(storm, forecastPoints) {
  const currentTime = validIso(storm.lastUpdate) || validIso(storm.advisoryIssuance);
  const advisoryTime = validIso(storm.advisoryIssuance) || currentTime;
  const advisoryLabel = storm.advisoryNumber ? `, advisory ${storm.advisoryNumber}` : "";
  const trackName = `${storm.name || storm.id || "Storm"} - NOAA forecast${advisoryLabel}`;
  const currentDescription = [
    "Current NOAA storm position",
    storm.category ? `Classification: ${storm.category}` : null,
    Number.isFinite(Number(storm.intensity)) ? `Maximum wind: ${Number(storm.intensity)} kn` : null,
    Number.isFinite(Number(storm.pressure)) ? `Pressure: ${Number(storm.pressure)} hPa` : null,
    Number.isFinite(Number(storm.movementDir)) ? `Movement: ${Number(storm.movementDir)} deg at ${Number(storm.movementSpeed) || 0} kn` : null,
    storm.advisoryNumber ? `Advisory: ${storm.advisoryNumber}` : null
  ].filter(Boolean).join("\n");

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="noaa-storms" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 https://www.topografix.com/GPX/1/1/gpx.xsd">',
    "  <metadata>",
    `    <name>${xml(trackName)}</name>`,
    "    <desc>Official NOAA tropical cyclone forecast track. Not for navigation.</desc>",
    advisoryTime ? `    <time>${xml(advisoryTime)}</time>` : null,
    "  </metadata>",
    `  <wpt lat="${storm.stormLat}" lon="${storm.stormLon}">`,
    currentTime ? `    <time>${xml(currentTime)}</time>` : null,
    `    <name>${xml(`${storm.name || "Storm"} START`)}</name>`,
    `    <desc>${xml(currentDescription)}</desc>`,
    storm.forecastAdvisoryUrl ? `    <link href="${xml(storm.forecastAdvisoryUrl)}"><text>NOAA Forecast Advisory</text></link>` : null,
    `    <sym>${startSymbol(storm)}</sym>`,
    "    <type>WPT</type>",
    "  </wpt>"
  ].filter(Boolean);

  for (const point of forecastPoints) {
    lines.push(
      `  <wpt lat="${point.lat}" lon="${point.lon}">`,
      `    <time>${xml(point.time)}</time>`,
      `    <name>${xml(`${storm.name || "Storm"} ${utcPointLabel(point.time)}`)}</name>`,
      `    <desc>${xml(pointDescription(storm, point))}</desc>`,
      ...(storm.forecastAdvisoryUrl ? [`    <link href="${xml(storm.forecastAdvisoryUrl)}"><text>NOAA Forecast Advisory</text></link>`] : []),
      "    <sym>diamond</sym>",
      "    <type>WPT</type>",
      "  </wpt>"
    );
  }

  lines.push(
    "  <trk>",
    `    <name>${xml(trackName)}</name>`,
    "    <desc>Official NOAA forecast track; not a vessel route.</desc>",
    "    <type>NOAA tropical cyclone forecast</type>",
    "    <trkseg>",
    `      <trkpt lat="${storm.stormLat}" lon="${storm.stormLon}">${currentTime ? `<time>${xml(currentTime)}</time>` : ""}</trkpt>`
  );
  for (const point of forecastPoints) {
    lines.push(`      <trkpt lat="${point.lat}" lon="${point.lon}"><time>${xml(point.time)}</time></trkpt>`);
  }
  lines.push("    </trkseg>", "  </trk>", "</gpx>", "");
  return lines.join("\n");
}

function safeStormId(value) {
  const id = String(value || "").toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{1,63}$/.test(id) ? id : null;
}

function filenameFor(stormId) {
  const safeId = safeStormId(stormId);
  return safeId ? `${FILE_PREFIX}${safeId}-current.gpx` : null;
}

async function atomicWrite(filePath, data, fsApi = fs) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fsApi.writeFile(tempPath, data, { encoding: "utf8", mode: 0o644 });
    await fsApi.rename(tempPath, filePath);
  } catch (error) {
    await fsApi.unlink(tempPath).catch(() => {});
    throw error;
  }
}

function emptyManifest() {
  return { version: 1, files: {} };
}

async function readManifest(directory, fsApi = fs) {
  try {
    const parsed = JSON.parse(await fsApi.readFile(path.join(directory, MANIFEST_NAME), "utf8"));
    if (parsed?.version !== 1 || !parsed.files || typeof parsed.files !== "object") {
      return emptyManifest();
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return emptyManifest();
    throw error;
  }
}

function managedPath(directory, filename) {
  if (
    typeof filename !== "string" ||
    path.basename(filename) !== filename ||
    !filename.startsWith(FILE_PREFIX) ||
    !filename.endsWith("-current.gpx")
  ) {
    return null;
  }
  const resolvedDirectory = path.resolve(directory);
  const resolvedFile = path.resolve(directory, filename);
  return path.dirname(resolvedFile) === resolvedDirectory ? resolvedFile : null;
}

async function updateGpxFiles({ storms, listedStormIds, config, fetchImpl = fetch, fsApi = fs }) {
  const statuses = new Map();
  const candidates = Array.isArray(storms) ? storms : [];

  if (!config.recordGpx) {
    for (const storm of candidates) statuses.set(storm.id, { state: "skipped", message: "GPX recording disabled" });
    return statuses;
  }
  if (config.dataMode === "test") {
    for (const storm of candidates) statuses.set(storm.id, { state: "skipped", message: "GPX export is disabled in test mode" });
    return statuses;
  }
  if (!config.gpxOutputDirectory) {
    for (const storm of candidates) statuses.set(storm.id, { state: "skipped", message: "GPX output directory not configured" });
    return statuses;
  }
  if (!path.isAbsolute(config.gpxOutputDirectory)) {
    for (const storm of candidates) statuses.set(storm.id, { state: "skipped", message: "GPX output directory must be an absolute path" });
    return statuses;
  }

  const directory = path.resolve(config.gpxOutputDirectory);
  await fsApi.mkdir(directory, { recursive: true });
  const manifest = await readManifest(directory, fsApi);
  let manifestChanged = false;

  for (const storm of candidates) {
    const filename = filenameFor(storm.id);
    if (!filename) {
      statuses.set(storm.id, { state: "error", message: "Invalid NOAA storm ID" });
      continue;
    }
    if (!storm.forecastAdvisoryUrl || !storm.advisoryIssuance) {
      statuses.set(storm.id, { state: "waiting", message: "Waiting for NOAA forecast advisory" });
      continue;
    }

    try {
      const advisoryKey = `${storm.advisoryNumber || ""}|${storm.advisoryIssuance}`;
      const existing = manifest.files[storm.id];
      if (
        existing &&
        typeof existing === "object" &&
        existing.filename === filename &&
        existing.advisoryKey === advisoryKey
      ) {
        await fsApi.access(path.join(directory, filename));
        statuses.set(storm.id, {
          state: "written",
          message: "GPX file is current",
          filename,
          pointCount: existing.pointCount
        });
        continue;
      }

      const response = await fetchImpl(`${storm.forecastAdvisoryUrl}?text`, {
        headers: { "User-Agent": config.userAgent }
      });
      if (!response.ok) throw new Error(`NOAA forecast HTTP ${response.status}`);
      const points = parseForecastAdvisory(await response.text(), storm.advisoryIssuance);
      if (!points.length) {
        statuses.set(storm.id, { state: "waiting", message: "No usable NOAA forecast points" });
        continue;
      }

      await atomicWrite(path.join(directory, filename), buildGpx(storm, points), fsApi);
      manifest.files[storm.id] = {
        filename,
        advisoryKey,
        pointCount: points.length + 1
      };
      manifestChanged = true;
      statuses.set(storm.id, { state: "written", message: "GPX file written", filename, pointCount: points.length + 1 });
    } catch (error) {
      statuses.set(storm.id, { state: "error", message: error.message || String(error) });
    }
  }

  if (config.deleteInactiveGpx) {
    const listed = new Set((listedStormIds || []).map(String));
    for (const [stormId, entry] of Object.entries(manifest.files)) {
      if (listed.has(stormId)) continue;
      const filename = typeof entry === "string" ? entry : entry?.filename;
      const filePath = managedPath(directory, filename);
      if (!filePath) continue;
      await fsApi.unlink(filePath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
      delete manifest.files[stormId];
      manifestChanged = true;
    }
  }

  if (manifestChanged) {
    await atomicWrite(path.join(directory, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, fsApi);
  }
  return statuses;
}

module.exports = {
  buildGpx,
  filenameFor,
  parseForecastAdvisory,
  updateGpxFiles
};
