module.exports = function (app) {
  const plugin = {};

const packageJson = require("./package.json");
const PLUGIN_VERSION = packageJson.version;
  const PLUGIN_ID = "noaa-storms";
  const DEFAULT_NOAA_URL = "https://www.nhc.noaa.gov/CurrentStorms.json";

  let timer = null;
  let stopped = false;
  let unsubscribes = [];
  let latestBoatPos = null;
  let latest = buildEmptyObject(defaultConfig());
  let routesRegistered = false;
  let noaaHttpCache = {
    etag: null,
    lastModified: null,
    raw: null,
    fetchedAt: null,
    cacheHit: false
  };

  plugin.id = "noaa-storms";
  plugin.name = "noaa-storms";
  plugin.description = "NOAA Storm monitor";
  plugin.version = PLUGIN_VERSION;

  plugin.schema = function () {
    return {
      type: "object",
      properties: {
        dataMode: {
          type: "string",
          title: "Data mode",
          default: "live",
          enum: ["live", "test"]
        },
        noaaUrl: {
          type: "string",
          title: "NOAA URL",
          default: DEFAULT_NOAA_URL
        },
        pollNormalMin: {
          type: "number",
          title: "Poll normal (min)",
          default: 720
        },
        pollWarningMin: {
          type: "number",
          title: "Poll warning (min)",
          default: 60
        },
        pollAlarmMin: {
          type: "number",
          title: "Poll alarm (min)",
          default: 15
        },
        warnNm: {
          type: "number",
          title: "Warning threshold (nm)",
          default: 500
        },
        alarmNm: {
          type: "number",
          title: "Alarm threshold (nm)",
          default: 250
        }
      }
    };
  };

  function defaultConfig() {
    return {
      dataMode: "live",
      noaaUrl: DEFAULT_NOAA_URL,
      pollNormalMin: 720,
      pollWarningMin: 60,
      pollAlarmMin: 15,
      warnNm: 500,
      alarmNm: 250
    };
  }

  function sanitizeConfig(options) {
    const d = defaultConfig();

    const cfg = {
      dataMode: options?.dataMode === "test" ? "test" : "live",
      noaaUrl: typeof options?.noaaUrl === "string" && options.noaaUrl.trim()
        ? options.noaaUrl.trim()
        : d.noaaUrl,
      pollNormalMin: Number(options?.pollNormalMin),
      pollWarningMin: Number(options?.pollWarningMin),
      pollAlarmMin: Number(options?.pollAlarmMin),
      warnNm: Number(options?.warnNm),
      alarmNm: Number(options?.alarmNm)
    };

    if (!Number.isFinite(cfg.pollNormalMin) || cfg.pollNormalMin < 1) cfg.pollNormalMin = d.pollNormalMin;
    if (!Number.isFinite(cfg.pollWarningMin) || cfg.pollWarningMin < 1) cfg.pollWarningMin = d.pollWarningMin;
    if (!Number.isFinite(cfg.pollAlarmMin) || cfg.pollAlarmMin < 1) cfg.pollAlarmMin = d.pollAlarmMin;
    if (!Number.isFinite(cfg.warnNm) || cfg.warnNm < 1) cfg.warnNm = d.warnNm;
    if (!Number.isFinite(cfg.alarmNm) || cfg.alarmNm < 1) cfg.alarmNm = d.alarmNm;

    if (cfg.alarmNm > cfg.warnNm) {
      cfg.warnNm = d.warnNm;
      cfg.alarmNm = d.alarmNm;
    }

    return cfg;
  }

  function getConfig() {
    const options =
      (typeof app.getPluginOptions === "function" && app.getPluginOptions()) ||
      plugin.options ||
      {};

    return sanitizeConfig(options);
  }

  function resolveTimeZone(cfg) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz || typeof tz !== "string") return false;
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
      return tz;
    } catch (e) {
      return false;
    }
  }

  function buildEmptyObject(cfg) {
    return {
      version: {
        plugin: PLUGIN_VERSION,
        html: null
      },
      config: cfg,
      runtime: {
        state: "normal",
        message: "No active storm",
        dataMode: cfg.dataMode,
        lastRequest: null,
        nextRequest: null,
        intervalMs: null,
        timerActive: false,
        httpCache: null
      },
      data: {
        active: false,
        activeLabel: "no",
        timeZone: resolveTimeZone(cfg),
        stormCount: 0,
        invalidCount: 0,
        boat: null,
        storms: [],
        invalid: []
      }
    };
  }

  function setNoStoreHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  function toNumberOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function toTextOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    return String(v);
  }

  function debug(message) {
    if (typeof app.debug === "function") app.debug(message);
  }

function extractSource(delta, upd, valueObj) {
  return (
    valueObj?.$source ||
    valueObj?.source?.label ||
    valueObj?.source?.src ||
    valueObj?.source?.talker ||
    valueObj?.source ||
    upd?.source?.label ||
    upd?.source?.src ||
    upd?.source?.talker ||
    upd?.source?.$source ||
    upd?.$source ||
    delta?.$source ||
    "unknown"
  );
}

  function startBoatSubscription() {
    if (!app.subscriptionmanager || typeof app.subscriptionmanager.subscribe !== "function") {
      debug("NOAA: subscriptionmanager not available");
      return;
    }

    app.subscriptionmanager.subscribe(
      {
        context: "vessels.self",
        subscribe: [
          {
            path: "navigation.position",
            period: 1000
          }
        ]
      },
      unsubscribes,
      (err) => {
        app.setPluginError("Boat position subscribe error: " + (err?.message || String(err)));
      },
      (delta) => {
        if (!delta || !Array.isArray(delta.updates)) return;

        delta.updates.forEach((upd) => {
          if (!Array.isArray(upd.values)) return;

          upd.values.forEach((v) => {
            if (
              v.path !== "navigation.position" ||
              !v.value ||
              !Number.isFinite(Number(v.value.latitude)) ||
              !Number.isFinite(Number(v.value.longitude))
            ) {
              return;
            }

            latestBoatPos = {
              lat: Number(v.value.latitude),
              lon: Number(v.value.longitude),
              ts: upd.timestamp ? new Date(upd.timestamp).getTime() : Date.now(),
              source: String(extractSource(delta, upd, v.value))
            };
          });
        });
      }
    );
  }

function getBoatPosition() {
  const candidates = [];

  try {
    if (typeof app.getSelfPath === "function") {
      candidates.push(app.getSelfPath("navigation.position"));
    }
  } catch (e) {}

  try {
    const p = app.signalk?.self?.navigation?.position;
    if (p) candidates.push(p);
    if (p?.value) candidates.push(p.value);
  } catch (e) {}

  try {
    const p = app.getPath?.("vessels.self.navigation.position");
    if (p) candidates.push(p);
  } catch (e) {}

  for (const raw of candidates) {
    const boat = normalizeBoatPosition(raw);
    if (boat) {
      latestBoatPos = boat;
      return boat;
    }
  }

  return false;
}

function normalizeBoatPosition(raw) {
  if (!raw) return false;

  const value =
    raw.value && typeof raw.value === "object"
      ? raw.value
      : raw;

  const lat = Number(value.latitude);
  const lon = Number(value.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }

  let source = "unknown";

  if (raw.$source) source = raw.$source;
  else if (raw.source?.label) source = raw.source.label;
  else if (raw.source?.src) source = raw.source.src;
  else if (typeof raw.source === "string") source = raw.source;

  return {
    lat,
    lon,
    ts: raw.timestamp ? new Date(raw.timestamp).getTime() : Date.now(),
    source
  };
}

  function getFallbackBoatPositionForTest() {
    return {
      lat: 12.05,
      lon: -61.75,
      ts: Date.now(),
      source: "test-fallback"
    };
  }

  function toRad(deg) {
    return deg * Math.PI / 180;
  }

  function toDeg(rad) {
    return rad * 180 / Math.PI;
  }

  function normalizeDeg(deg) {
    return ((deg % 360) + 360) % 360;
  }

  function calcDistanceAndBearing(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const dPhi = toRad(lat2 - lat1);
    const dLambda = toRad(lon2 - lon1);

    const a =
      Math.sin(dPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceM = R * c;
    const distanceNm = distanceM / 1852;

    const y = Math.sin(dLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

    const bearingDeg = normalizeDeg(toDeg(Math.atan2(y, x)));
    const bearingRad = toRad(bearingDeg);

    return { distanceM, distanceNm, bearingDeg, bearingRad };
  }

  function destinationPoint(lat, lon, bearingDeg, distanceNm) {
    const R = 6371000;
    const distanceM = distanceNm * 1852;
    const angularDistance = distanceM / R;
    const bearing = toRad(bearingDeg);
    const lat1 = toRad(lat);
    const lon1 = toRad(lon);

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      lat: toDeg(lat2),
      lon: ((toDeg(lon2) + 540) % 360) - 180
    };
  }

  function parseCoord(value, hemiHint) {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const s = String(value).trim().toUpperCase();
    const m = s.match(/^(-?\d+(?:\.\d+)?)([NSEW])?$/);
    if (!m) return null;

    let num = Number(m[1]);
    if (!Number.isFinite(num)) return null;

    const hemi = m[2] || hemiHint || "";
    if (hemi === "S" || hemi === "W") num = -Math.abs(num);
    if (hemi === "N" || hemi === "E") num = Math.abs(num);

    return num;
  }

  function normalizeStorms(raw, cfg) {
    const activeStorms = Array.isArray(raw?.activeStorms) ? raw.activeStorms : [];
    const storms = [];
    const invalid = [];

    for (const s of activeStorms) {
      const stormLat = toNumberOrNull(s.latitude_numeric) ?? parseCoord(s.latitude, "N");
      const stormLon = toNumberOrNull(s.longitude_numeric) ?? parseCoord(s.longitude, "W");

      if (!Number.isFinite(stormLat) || !Number.isFinite(stormLon)) {
        invalid.push({
          name: s.name || "unknown",
          error: "invalid coordinates"
        });
        continue;
      }

      storms.push({
        name: s.name || "unknown",
        category: s.classification || s.category || "",
        stormLat,
        stormLon,
        intensity: toNumberOrNull(s.intensity),
        movementDir: toNumberOrNull(s.movementDir),
        movementSpeed: toNumberOrNull(s.movementSpeed),
        lastUpdate: toTextOrNull(s.lastUpdate)
      });
    }

    return {
      active: storms.length > 0,
      activeLabel: storms.length > 0 ? "yes" : "no (No storm warnings)",
      timeZone: resolveTimeZone(cfg),
      stormCount: storms.length,
      invalidCount: invalid.length,
      storms,
      invalid
    };
  }

  function buildRelativeTestData(cfg, boat) {
    const baseBoat = boat || getFallbackBoatPositionForTest();
    const now = new Date().toISOString();

    const hurricanePos = destinationPoint(baseBoat.lat, baseBoat.lon, 45, cfg.alarmNm);
    const stormPos = destinationPoint(baseBoat.lat, baseBoat.lon, 90, cfg.warnNm);
    const depressionPos = destinationPoint(baseBoat.lat, baseBoat.lon, 135, cfg.warnNm + 50);

    return {
      active: true,
      activeLabel: "yes",
      timeZone: resolveTimeZone(cfg),
      stormCount: 3,
      invalidCount: 0,
      invalid: [],
      storms: [
        {
          name: "TEST-HURRICANE",
          category: "HU",
          stormLat: hurricanePos.lat,
          stormLon: hurricanePos.lon,
          intensity: 85,
          movementDir: 285,
          movementSpeed: 12,
          lastUpdate: now
        },
        {
          name: "TEST-STORM",
          category: "TS",
          stormLat: stormPos.lat,
          stormLon: stormPos.lon,
          intensity: 45,
          movementDir: 270,
          movementSpeed: 15,
          lastUpdate: now
        },
        {
          name: "TEST-DEPRESSION",
          category: "TD",
          stormLat: depressionPos.lat,
          stormLon: depressionPos.lon,
          intensity: 30,
          movementDir: 250,
          movementSpeed: 10,
          lastUpdate: now
        }
      ]
    };
  }

  function enrichStorms(data, boat) {
    const storms = Array.isArray(data?.storms) ? data.storms : [];

    const enriched = storms.map((s) => {
      const out = {
        ...s,
        boatLat: boat ? boat.lat : null,
        boatLon: boat ? boat.lon : null,
        distanceNm: null,
        distanceM: null,
        bearingDeg: null,
        bearingRad: null
      };

      if (boat && Number.isFinite(Number(out.stormLat)) && Number.isFinite(Number(out.stormLon))) {
        const calc = calcDistanceAndBearing(
          boat.lat,
          boat.lon,
          Number(out.stormLat),
          Number(out.stormLon)
        );

        out.distanceNm = calc.distanceNm;
        out.distanceM = calc.distanceM;
        out.bearingDeg = calc.bearingDeg;
        out.bearingRad = calc.bearingRad;
      }

      return out;
    });

    enriched.sort((a, b) => {
      const da = Number.isFinite(Number(a.distanceNm)) ? Number(a.distanceNm) : Infinity;
      const db = Number.isFinite(Number(b.distanceNm)) ? Number(b.distanceNm) : Infinity;
      return da - db;
    });

    return enriched;
  }

  function buildRuntime(storms, cfg, prevRuntime) {
    let state = "normal";
    let message = "No active storm";
    const nearest = storms.length ? storms[0] : null;

    if (nearest) {
      const dist = Number(nearest.distanceNm);

      if (Number.isFinite(dist)) {
        if (dist <= cfg.alarmNm) state = "alarm";
        else if (dist <= cfg.warnNm) state = "warning";

        message = `${nearest.name || "Storm"} ${nearest.category || ""} in ${dist.toFixed(1)} nm`;
      } else {
        state = "warning";
        message = "Storm present, but boat position missing";
      }
    }

    return {
      state,
      message,
      dataMode: cfg.dataMode,
      lastRequest: new Date().toISOString(),
      nextRequest: prevRuntime?.nextRequest || null,
      intervalMs: prevRuntime?.intervalMs || null,
      timerActive: prevRuntime?.timerActive || false
    };
  }

  function nextIntervalMs(state, cfg) {
    if (state === "alarm") return cfg.pollAlarmMin * 60 * 1000;
    if (state === "warning") return cfg.pollWarningMin * 60 * 1000;
    return cfg.pollNormalMin * 60 * 1000;
  }

  function publishToSignalK(obj) {
    app.handleMessage(plugin.id, {
      updates: [
        {
          values: [
            {
              path: "custom.noaaHurricane",
              value: obj
            }
          ]
        }
      ]
    });
  }

  function updateNotification(obj) {
    const storms = Array.isArray(obj?.data?.storms) ? obj.data.storms : [];
    const cfg = obj?.config || getConfig();

    let notif;

    if (!storms.length) {
      notif = {
        state: "normal",
        message: "No storm warnings",
        method: ["visual", "sound"]
      };
    } else {
      const s = storms[0];
      const dist = Number(s.distanceNm);

      if (!Number.isFinite(dist)) {
        notif = {
          state: "warn",
          message: "Storm present, but boat position missing",
          method: ["visual", "sound"]
        };
      } else {
        let state = "normal";
        if (dist <= cfg.alarmNm) state = "alarm";
        else if (dist <= cfg.warnNm) state = "warn";

        notif = {
          state,
          message: state === "normal"
            ? "No storm warnings"
            : `${s.name || "unknown"} ${s.category || "Storm"} in ${dist.toFixed(1)} nm`,
          method: ["visual", "sound"]
        };
      }
    }

    app.handleMessage(plugin.id, {
      updates: [
        {
          values: [
            {
              path: "notifications.noaaHurricane.nearest",
              value: notif
            }
          ]
        }
      ]
    });
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function scheduleNext(obj) {
    clearTimer();

    const cfg = obj.config || getConfig();
    const intervalMs = nextIntervalMs(obj.runtime.state, cfg);
    const nextTs = Date.now() + intervalMs;

    obj.runtime.intervalMs = intervalMs;
    obj.runtime.nextRequest = new Date(nextTs).toISOString();
    obj.runtime.timerActive = true;

    latest = obj;
    publishToSignalK(obj);

    timer = setTimeout(() => {
      runCycle("scheduled");
    }, intervalMs);

    app.setPluginStatus(
      `${obj.runtime.dataMode} | ${obj.runtime.state} | next poll ${Math.round(intervalMs / 60000)} min`
    );
  }

  async function fetchNoaaJson(cfg) {
    const headers = {
      "User-Agent": `${PLUGIN_ID}/${PLUGIN_VERSION}`,
      "Accept": "application/json"
    };

    if (noaaHttpCache.etag) {
      headers["If-None-Match"] = noaaHttpCache.etag;
    }

    if (noaaHttpCache.lastModified) {
      headers["If-Modified-Since"] = noaaHttpCache.lastModified;
    }

    const res = await fetch(cfg.noaaUrl, { headers });

    if (res.status === 304) {
      if (!noaaHttpCache.raw) {
        throw new Error("NOAA HTTP 304 but local cache is empty");
      }

      noaaHttpCache.cacheHit = true;
      return noaaHttpCache.raw;
    }

    if (!res.ok) throw new Error(`NOAA HTTP ${res.status}`);

    const raw = await res.json();

    noaaHttpCache = {
      etag: res.headers.get("etag") || noaaHttpCache.etag,
      lastModified: res.headers.get("last-modified") || noaaHttpCache.lastModified,
      raw,
      fetchedAt: new Date().toISOString(),
      cacheHit: false
    };

    return raw;
  }

  async function runCycle(reason) {
    if (stopped) return;

    const cfg = getConfig();
    const realBoat = getBoatPosition() || false;
    const boat = cfg.dataMode === "test" && realBoat === false
      ? getFallbackBoatPositionForTest()
      : realBoat;

    try {
      app.setPluginStatus(`Polling ${cfg.dataMode} (${reason})`);

      let normalizedData;

      if (cfg.dataMode === "test") {
        normalizedData = buildRelativeTestData(cfg, boat);
      } else {
        const raw = await fetchNoaaJson(cfg);
        normalizedData = normalizeStorms(raw, cfg);
      }

      const storms = enrichStorms(normalizedData, boat);
      const runtime = buildRuntime(storms, cfg, latest?.runtime);

      const obj = {
        version: {
          plugin: PLUGIN_VERSION,
          html: null
        },
        config: cfg,
        runtime: {
          ...runtime,
          httpCache: cfg.dataMode === "live"
            ? {
                etag: noaaHttpCache.etag,
                lastModified: noaaHttpCache.lastModified,
                fetchedAt: noaaHttpCache.fetchedAt,
                cacheHit: noaaHttpCache.cacheHit
              }
            : null
        },
        data: {
          ...normalizedData,
          timeZone: resolveTimeZone(cfg),
          boat,
          stormCount: storms.length,
          invalidCount: Array.isArray(normalizedData.invalid) ? normalizedData.invalid.length : 0,
          storms
        }
      };

      latest = obj;
      updateNotification(obj);
      scheduleNext(obj);

      app.setPluginStatus(`${runtime.dataMode} | ${runtime.state} | ${runtime.message}`);
      //app.setPluginError("");
    } catch (err) {
      const msg = err?.message || String(err);
      const obj = latest || buildEmptyObject(cfg);

      obj.config = cfg;
      obj.runtime = {
        ...obj.runtime,
        dataMode: cfg.dataMode,
        message: `${cfg.dataMode} fetch failed: ${msg}`,
        lastRequest: new Date().toISOString()
      };
      obj.data = {
        ...(obj.data || {}),
        timeZone: resolveTimeZone(cfg),
        boat
      };

      latest = obj;
      publishToSignalK(obj);
      app.setPluginError(`${cfg.dataMode} fetch failed: ${msg}`);

      clearTimer();

      const fallbackMs = cfg.pollWarningMin * 60 * 1000;
      obj.runtime.intervalMs = fallbackMs;
      obj.runtime.nextRequest = new Date(Date.now() + fallbackMs).toISOString();
      obj.runtime.timerActive = true;

      publishToSignalK(obj);

      timer = setTimeout(() => {
        runCycle("retry-after-error");
      }, fallbackMs);
    }
  }

  function registerRoutesOnce() {
    if (routesRegistered) return;
    routesRegistered = true;

app.get("/noaa-storms/status", (req, res) => {
  setNoStoreHeaders(res);
  res.json({
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginVersion: plugin.version,
    config: getConfig(),
    runtime: latest?.runtime || null
  });
});

app.get("/noaa-storms/data", (req, res) => {
  setNoStoreHeaders(res);

  const cfg = getConfig();
  const obj = latest || buildEmptyObject(cfg);
  const boat = getBoatPosition();

  obj.config = cfg;
  obj.data = {
    ...(obj.data || {}),
    boat: boat || false,
    timeZone: resolveTimeZone(cfg)
  };

  res.json(obj);
});

    app.get("/plugins/noaa-storms/status", (req, res) => {
      setNoStoreHeaders(res);
      res.json({
        pluginId: plugin.id,
        pluginName: plugin.name,
        pluginVersion: plugin.version,
        config: getConfig(),
        runtime: latest?.runtime || null
      });
    });

app.get("/plugins/noaa-storms/data", (req, res) => {
  setNoStoreHeaders(res);

  const cfg = getConfig();
  const obj = latest || buildEmptyObject(cfg);

  const boat = getBoatPosition();

  obj.config = cfg;
  obj.data = {
    ...(obj.data || {}),
    boat: boat || false,
    timeZone: resolveTimeZone(cfg)
  };

  res.json(obj);
});
}

  plugin.start = function (options) {
    stopped = false;
    plugin.options = options || {};
    unsubscribes = [];
    latestBoatPos = null;
    noaaHttpCache = {
      etag: null,
      lastModified: null,
      raw: null,
      fetchedAt: null,
      cacheHit: false
    };

    const cfg = getConfig();
    latest = buildEmptyObject(cfg);
    publishToSignalK(latest);

    registerRoutesOnce();
    startBoatSubscription();
setTimeout(() => {
  runCycle("startup-delayed");
}, 1500);
  };

  plugin.stop = function () {
    stopped = true;
    clearTimer();

    unsubscribes.forEach((fn) => {
      try {
        if (typeof fn === "function") fn();
      } catch (e) {
        // ignore
      }
    });

    unsubscribes = [];
    latestBoatPos = null;

    if (latest?.runtime) {
      latest.runtime.timerActive = false;
      latest.runtime.nextRequest = null;
      publishToSignalK(latest);
    }

    app.setPluginStatus("Stopped");
  };

  return plugin;
};
