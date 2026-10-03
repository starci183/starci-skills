// protected-installations.spec.mjs - the host protection policy comes from one validated data contract.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isProtectedContainer,
  isProtectedPort,
  loadProtectedInstallations,
  protectedPortLabel,
  protectedPortsInText,
} from '../../scripts/lib/protected-installations.mjs';

test('the real contract supplies protected container markers, exact ports and ranges', () => {
  assert.equal(isProtectedContainer('prefix-nivo-lite-db'), true);
  assert.equal(isProtectedContainer('starci-owned'), false);
  assert.equal(isProtectedPort(3100), true);
  assert.equal(isProtectedPort(54325), true);
  assert.equal(isProtectedPort(44000), false);
  assert.equal(protectedPortLabel(55322), '55321-55327');
  assert.deepEqual(protectedPortsInText('EXPOSE 3100 44000 54320 3100'), [3100, 54320]);
});

test('the loader rejects malformed marker and range data', () => {
  assert.throws(() => loadProtectedInstallations({ readFile: () => 'schema: starci/protected-installations@1\ncontainerMarkers: []\nports: {list: [], ranges: []}\n' }), /containerMarkers/);
  assert.throws(() => loadProtectedInstallations({ readFile: () => 'schema: starci/protected-installations@1\ncontainerMarkers: [foreign]\nports: {list: [], ranges: [{first: 20, last: 10}]}\n' }), /ordered host-port ranges/);
});
