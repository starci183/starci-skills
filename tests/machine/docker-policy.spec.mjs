import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOCKER_PORT_POLICY,
  dockerProjectName,
  isForeignContainer,
  ownershipFilters,
  refusePortPolicy,
} from '../../scripts/machine/docker-policy.mjs';

const compose = (port, containerName) => ({ services: { api: { ports: port == null ? [] : [{ published: port, target: 8080 }], ...(containerName ? { container_name: containerName } : {}) } } });

for (const port of [3000, 3100, 54325, 55322, 40999, 45000]) {
  test(`port policy refuses published host port ${port}`, () => {
    const refusal = refusePortPolicy(compose(port));
    assert.equal(refusal.code, DOCKER_PORT_POLICY);
    assert.match(refusal.message, new RegExp(String(port)));
  });
}

for (const port of [41000, 41001, 44999]) {
  test(`port policy accepts fallback project port ${port}`, () => assert.equal(refusePortPolicy(compose(port)), null));
}

test('port policy reads Compose short syntax', () => {
  assert.equal(refusePortPolicy({ services: { api: { ports: ['127.0.0.1:41001:3000/tcp'] } } }), null);
  assert.equal(refusePortPolicy({ services: { api: { ports: ['127.0.0.1:3100:3000'] } } })?.code, DOCKER_PORT_POLICY);
});

test('port policy refuses a dynamically assigned published host port', () => {
  assert.match(refusePortPolicy({ services: { api: { ports: ['3000'] } } })?.message ?? '', /not fixed/);
  assert.match(refusePortPolicy({ services: { api: { ports: [{ target: 3000 }] } } })?.message ?? '', /not fixed/);
});

test('nivo-lite names are foreign independent of case and otherwise ordinary names are ours', () => {
  for (const name of ['nivo-lite', 'starci-NIVO-LITE-db', '/nivo-lite-api-1']) assert.equal(isForeignContainer(name), true, name);
  for (const name of ['nivo', 'starci-shop-api-1', 'lite-api']) assert.equal(isForeignContainer(name), false, name);
  assert.equal(refusePortPolicy(compose(41001, 'starci-nivo-lite-api'))?.code, DOCKER_PORT_POLICY);
  assert.equal(refusePortPolicy({ services: { 'nivo-lite-api': { ports: [{ published: 41001, target: 3000 }] } } })?.code, DOCKER_PORT_POLICY);
});

test('project naming and destructive filters require exact non-empty ownership', () => {
  assert.equal(dockerProjectName('shop', 'api'), 'starci-shop-api');
  assert.equal(dockerProjectName('Shop', 'api'), null);
  assert.deepEqual(ownershipFilters('shop', 'starci-shop-api'), ['label=starci.project=shop', 'label=com.docker.compose.project=starci-shop-api']);
  assert.throws(() => ownershipFilters('', 'starci-shop-api'), /empty label selector/);
});
