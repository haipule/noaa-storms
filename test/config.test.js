const assert = require("node:assert/strict");
const test = require("node:test");

const createPlugin = require("../index");

test("defines GPX settings in plugin configuration with safe defaults and order", () => {
  const plugin = createPlugin({});
  const properties = plugin.schema().properties;
  const keys = Object.keys(properties);

  assert.equal(properties.recordGpx.type, "boolean");
  assert.equal(properties.recordGpx.default, false);
  assert.equal(properties.gpxOutputDirectory.type, "string");
  assert.equal(properties.gpxOutputDirectory.default, "");
  assert.equal(properties.deleteInactiveGpx.type, "boolean");
  assert.equal(properties.deleteInactiveGpx.default, false);
  assert.ok(keys.indexOf("recordGpx") < keys.indexOf("gpxOutputDirectory"));
  assert.ok(keys.indexOf("gpxOutputDirectory") < keys.indexOf("deleteInactiveGpx"));
});

test("keeps Signal K notifications opt-in", () => {
  const plugin = createPlugin({});
  const properties = plugin.schema().properties;

  assert.equal(properties.notificationsEnabled.type, "boolean");
  assert.equal(properties.notificationsEnabled.default, false);
  assert.match(properties.notificationsEnabled.description, /notifications\.noaaHurricane\.nearest/);
});

test("clears legacy notifications and reports an unreviewed default on startup", () => {
  const messages = [];
  const app = {
    get: () => {},
    handleMessage: (_pluginId, message) => messages.push(message),
    setPluginStatus: () => {}
  };
  const plugin = createPlugin(app);

  plugin.start({});
  plugin.stop();

  const values = messages.flatMap((message) =>
    message.updates.flatMap((update) => update.values)
  );
  const runtime = values.find((entry) => entry.path === "custom.noaaHurricane");
  const notification = values.find(
    (entry) => entry.path === "notifications.noaaHurricane.nearest"
  );

  assert.equal(runtime.value.config.notificationsEnabled, false);
  assert.equal(runtime.value.config.notificationsConfigured, false);
  assert.equal(notification.value, null);
});
