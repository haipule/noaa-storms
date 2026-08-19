const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildGpx,
  filenameFor,
  parseForecastAdvisory,
  updateGpxFiles
} = require("../gpx");

const ADVISORY = `
<html><body><pre>
TROPICAL STORM TEST FORECAST/ADVISORY NUMBER  4
2100 UTC FRI AUG 30 2026

FORECAST VALID 31/0600Z 20.4N 165.8W
MAX WIND  60 KT...GUSTS  75 KT.

OUTLOOK VALID 01/1800Z 24.1N 172.2W
MAX WIND  70 KT...GUSTS  85 KT.
</pre></body></html>`;

function storm(overrides = {}) {
  return {
    id: "cp012026",
    name: "Lala & Test",
    category: "TS",
    stormLat: 20.4,
    stormLon: -164.3,
    intensity: 55,
    pressure: 994,
    movementDir: 260,
    movementSpeed: 10,
    lastUpdate: "2026-08-30T21:00:00.000Z",
    advisoryNumber: "004",
    advisoryIssuance: "2026-08-30T21:00:00.000Z",
    forecastAdvisoryUrl: "https://www.nhc.noaa.gov/text/TEST.shtml",
    ...overrides
  };
}

function response(body = ADVISORY) {
  return {
    ok: true,
    status: 200,
    text: async () => body
  };
}

test("parses official forecast and outlook points across a month boundary", () => {
  const points = parseForecastAdvisory(ADVISORY, "2026-08-30T21:00:00.000Z");

  assert.deepEqual(points, [
    {
      time: "2026-08-31T06:00:00.000Z",
      lat: 20.4,
      lon: -165.8,
      maxWindKn: 60,
      gustKn: 75
    },
    {
      time: "2026-09-01T18:00:00.000Z",
      lat: 24.1,
      lon: -172.2,
      maxWindKn: 70,
      gustKn: 85
    }
  ]);
});

test("builds GPX 1.1 with a forecast track and informative waypoints", () => {
  const points = parseForecastAdvisory(ADVISORY, "2026-08-30T21:00:00.000Z");
  const gpx = buildGpx(storm(), points);

  assert.match(gpx, /<gpx version="1\.1"/);
  assert.match(gpx, /<trk>/);
  assert.match(gpx, /<name>Lala &amp; Test - NOAA forecast, advisory 004<\/name>/);
  assert.match(gpx, /<name>Lala &amp; Test 31 0600Z<\/name>/);
  assert.match(gpx, /Maximum wind: 60 kn/);
  assert.match(gpx, /Gusts: 75 kn/);
  assert.match(gpx, /Pressure: 994 hPa/);
  assert.match(gpx, /Not for navigation/);
  assert.equal((gpx.match(/<trkpt /g) || []).length, 3);
  assert.equal((gpx.match(/<wpt /g) || []).length, 3);
});

test("uses only safe NOAA storm IDs in managed filenames", () => {
  assert.equal(filenameFor("CP012026"), "noaa-storms-cp012026-current.gpx");
  assert.equal(filenameFor("../../foreign"), null);
  assert.equal(filenameFor("x"), null);
});

test("writes current files and removes only inactive manifest-owned files", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "noaa-storms-gpx-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const config = {
    recordGpx: true,
    deleteInactiveGpx: true,
    gpxOutputDirectory: directory,
    dataMode: "live",
    userAgent: "noaa-storms/test"
  };

  const first = await updateGpxFiles({
    storms: [storm()],
    listedStormIds: ["cp012026"],
    config,
    fetchImpl: async () => response()
  });
  assert.equal(first.get("cp012026").state, "written");
  assert.equal(first.get("cp012026").pointCount, 3);

  const generated = path.join(directory, "noaa-storms-cp012026-current.gpx");
  const foreign = path.join(directory, "my-own-route.gpx");
  await fs.access(generated);
  await fs.writeFile(foreign, "do not delete", "utf8");

  const unchanged = await updateGpxFiles({
    storms: [storm()],
    listedStormIds: ["cp012026"],
    config,
    fetchImpl: async () => {
      throw new Error("unchanged advisory must not be fetched again");
    }
  });
  assert.equal(unchanged.get("cp012026").message, "GPX file is current");

  await updateGpxFiles({
    storms: [],
    listedStormIds: [],
    config,
    fetchImpl: async () => response()
  });

  await assert.rejects(fs.access(generated), { code: "ENOENT" });
  assert.equal(await fs.readFile(foreign, "utf8"), "do not delete");
});

test("does not write or clean files when recording is disabled or in test mode", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "noaa-storms-gpx-off-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const marker = path.join(directory, "marker.txt");
  await fs.writeFile(marker, "keep", "utf8");

  const disabled = await updateGpxFiles({
    storms: [storm()],
    listedStormIds: [],
    config: {
      recordGpx: false,
      deleteInactiveGpx: true,
      gpxOutputDirectory: directory,
      dataMode: "live"
    },
    fetchImpl: async () => {
      throw new Error("must not fetch");
    }
  });
  assert.equal(disabled.get("cp012026").state, "skipped");

  const testMode = await updateGpxFiles({
    storms: [storm()],
    listedStormIds: [],
    config: {
      recordGpx: true,
      deleteInactiveGpx: true,
      gpxOutputDirectory: directory,
      dataMode: "test"
    },
    fetchImpl: async () => {
      throw new Error("must not fetch");
    }
  });
  assert.equal(testMode.get("cp012026").state, "skipped");
  assert.equal(await fs.readFile(marker, "utf8"), "keep");
});

test("skips an ambiguous relative output directory", async () => {
  const statuses = await updateGpxFiles({
    storms: [storm()],
    listedStormIds: ["cp012026"],
    config: {
      recordGpx: true,
      deleteInactiveGpx: false,
      gpxOutputDirectory: "relative/gpx",
      dataMode: "live"
    },
    fetchImpl: async () => {
      throw new Error("must not fetch");
    }
  });

  assert.equal(statuses.get("cp012026").state, "skipped");
  assert.match(statuses.get("cp012026").message, /absolute path/);
});

test("reports a write error without leaving a partial GPX file", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "noaa-storms-gpx-error-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const diskFull = Object.assign({}, fs, {
    writeFile: async (file, ...args) => {
      if (String(file).endsWith(".tmp")) {
        const error = new Error("disk full");
        error.code = "ENOSPC";
        throw error;
      }
      return fs.writeFile(file, ...args);
    }
  });

  const statuses = await updateGpxFiles({
    storms: [storm()],
    listedStormIds: ["cp012026"],
    config: {
      recordGpx: true,
      deleteInactiveGpx: false,
      gpxOutputDirectory: directory,
      dataMode: "live",
      userAgent: "noaa-storms/test"
    },
    fetchImpl: async () => response(),
    fsApi: diskFull
  });

  assert.equal(statuses.get("cp012026").state, "error");
  assert.match(statuses.get("cp012026").message, /disk full/);
  assert.deepEqual(await fs.readdir(directory), []);
});
