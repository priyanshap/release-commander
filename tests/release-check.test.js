const test = require('node:test');
const assert = require('node:assert/strict');
const { isProductionReleaseAllowed } = require('../src/release-check');

test('release configuration allows production release', () => {
  assert.equal(isProductionReleaseAllowed(), true);
});
