const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldSyncStorefrontVisibility } = require('./productVisibility');

test('active products should sync storefront visibility', () => {
  assert.equal(shouldSyncStorefrontVisibility('ACTIVE', 'DRAFT'), true);
  assert.equal(shouldSyncStorefrontVisibility('ACTIVE', 'INACTIVE'), true);
  assert.equal(shouldSyncStorefrontVisibility('DRAFT', 'ACTIVE'), false);
  assert.equal(shouldSyncStorefrontVisibility('INACTIVE', 'ACTIVE'), false);
});
