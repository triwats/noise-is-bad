// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

// Packages that ship ES modules only and therefore need transforming before
// Jest can load them. The scaffold's list plus our own additions.
// See .config/README.md#esm-errors-with-jest
const esModules = [...grafanaESModules, 'd3-hierarchy', 'd3-array', 'internmap'];

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  transformIgnorePatterns: [nodeModulesToTransform(esModules)],
};
