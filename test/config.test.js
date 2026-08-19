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
