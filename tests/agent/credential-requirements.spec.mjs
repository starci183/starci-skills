import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import { credentialRequirements } from '../../scripts/lib/credential-requirements.mjs';

const cloudflare = (extra = {}) => ({ mode: 'named', auth: 'token', tokenEnv: 'OWNER_TUNNEL_TOKEN', tokenPresent: false, credentialsPresent: false, ...extra });
const telegram = (extra = {}) => ({ enabled: true, botTokenEnv: 'OWNER_BOT_TOKEN', botTokenPresent: false, ...extra });
const select = (services, connectors, adapters = []) => credentialRequirements({ services, connectors, adapters });

test('an action with no selected shared service reads no connector settings', () => {
  const input = { services: [], get connectors() { throw new Error('connector settings were read'); } };
  assert.deepEqual(credentialRequirements(input), { requirements: [], accountManaged: [] });
});

test('unrelated host services introduce no credential requirement or model key', () => {
  assert.deepEqual(select(['harness-ui', 'harness-tunnel', 'ask-gateway'], null), { requirements: [], accountManaged: [] });
});

test('named tunnel token mode uses the configured key and does not require the unused file alternative', () => {
  const connectors = { cloudflare: cloudflare() };
  assert.deepEqual(select(['ask-tunnel'], connectors).requirements,
    [{ feature: 'ask-tunnel', kind: 'env', name: 'OWNER_TUNNEL_TOKEN', present: false }]);
  connectors.cloudflare.tokenPresent = true;
  assert.equal(select(['ask-tunnel'], connectors).requirements[0].present, true);
});

test('off and quick tunnel modes need no named tunnel secret', () => {
  for (const mode of ['off', 'quick'])
    assert.deepEqual(select(['ask-tunnel'], { cloudflare: cloudflare({ mode, auth: null }) }).requirements, []);
});

test('named credentials-file mode reports file presence without demanding a token', () => {
  const connectors = { cloudflare: cloudflare({ auth: 'credentials-file', credentialsFile: 'not-returned.json' }) };
  assert.deepEqual(select(['ask-tunnel'], connectors).requirements,
    [{ feature: 'ask-tunnel', kind: 'file', name: 'connectors.cloudflare.credentialsFile', present: false }]);
  connectors.cloudflare.credentialsPresent = true;
  assert.equal(select(['ask-tunnel'], connectors).requirements[0].present, true);
  assert.ok(!JSON.stringify(select(['ask-tunnel'], connectors)).includes('not-returned.json'));
});

test('Telegram bridge requires its configured key only when enabled, while direct token-consuming actions remain explicit', () => {
  const connectors = { telegram: telegram({ enabled: false }) };
  assert.deepEqual(select(['telegram-bridge'], connectors).requirements, []);
  assert.deepEqual(select([{ name: 'telegram-bridge', explicit: true }], connectors).requirements,
    [{ feature: 'telegram-bridge', kind: 'env', name: 'OWNER_BOT_TOKEN', present: false }]);
  assert.equal(connectors.telegram.enabled, false, 'selection does not pretend the bridge is enabled');
  connectors.telegram.enabled = true;
  connectors.telegram.botTokenPresent = true;
  assert.equal(select(['telegram-bridge'], connectors).requirements[0].present, true);
});

test('mixed selections are deduplicated and return no credential values or normalized config payload', () => {
  const secret = 'dummy-value-that-must-not-escape';
  const connectors = { cloudflare: cloudflare({ token: secret }), telegram: telegram({ botToken: secret, enabled: false }) };
  const before = structuredClone(connectors);
  const result = select(['ask-tunnel', 'ask-tunnel', { name: 'telegram-bridge', explicit: true }, 'telegram-bridge'], connectors);
  assert.equal(result.requirements.length, 2);
  assert.deepEqual(result.requirements.map(({ name }) => name), ['OWNER_TUNNEL_TOKEN', 'OWNER_BOT_TOKEN']);
  assert.deepEqual(connectors, before);
  assert.ok(!JSON.stringify(result).includes(secret));
});

test('only boolean true proves presence and malformed selected connector contracts refuse', () => {
  for (const present of [undefined, null, 'true', 1, false])
    assert.equal(select(['ask-tunnel'], { cloudflare: cloudflare({ tokenPresent: present }) }).requirements[0].present, false);
  assert.throws(() => select(['ask-tunnel'], null), /normalized cloudflare settings/);
  assert.throws(() => select(['ask-tunnel'], { cloudflare: cloudflare({ auth: null }) }), /authentication mode/);
  assert.throws(() => select(['telegram-bridge'], { telegram: {} }), /normalized settings/);
  assert.throws(() => select(['ask-tunnel'], { cloudflare: cloudflare({ tokenEnv: null }) }), /needs a name/);
  assert.throws(() => credentialRequirements({ services: null }), /must be an array/);
});

test('selected current Codex Claude and opaque Devin native cards add no API key requirements or auth success claim', () => {
  const adapters = ['codex', 'claude', 'devin'].map(provider => ({ provider,
    card: parseYaml(fs.readFileSync(new URL('../../modules/models/agents/' + provider + '.yaml', import.meta.url), 'utf8')) }));
  const result = credentialRequirements({ adapters });
  assert.deepEqual(result.requirements, []);
  assert.deepEqual(result.accountManaged.map(({ provider, agent, api }) => ({ provider, agent, api })),
    adapters.map(({ provider, card }) => ({ provider, agent: card.start.agentArgument, api: card.start.api })));
  assert.equal(Object.hasOwn(result, 'authenticated'), false);
  assert.deepEqual(credentialRequirements({ adapters: [adapters[0], adapters[0]] }).accountManaged, [result.accountManaged[0]]);
  assert.throws(() => credentialRequirements({ adapters: [{ provider: 'unclassified', card: {} }] }), /supported native credential contract/);
});


test('selected action owners supply named requirements without values, URLs, or unrelated-action inference', () => {
  const declared = [
    { feature: 'analysis', kind: 'env', name: 'ANALYSIS_TOKEN', present: false, value: 'dummy-secret-not-for-output' },
    { feature: 'analysis', kind: 'config', name: 'analysis.host', present: true, url: 'https://private.invalid' },
  ];
  const before = structuredClone(declared);
  const result = credentialRequirements({ declaredRequirements: declared });
  assert.deepEqual(result.requirements, declared.map(({ feature, kind, name, present }) => ({ feature, kind, name, present })));
  assert.deepEqual(declared, before);
  assert.ok(!JSON.stringify(result).includes('dummy-secret-not-for-output'));
  assert.ok(!JSON.stringify(result).includes('private.invalid'));
  assert.deepEqual(credentialRequirements().requirements, []);
  assert.throws(() => credentialRequirements({ declaredRequirements: null }), /must be an array/);
  for (const row of [{ kind: 'env', name: 'N' }, { feature: 'selected', kind: 'other', name: 'N' }, { feature: 'selected', kind: 'env' }])
    assert.throws(() => credentialRequirements({ declaredRequirements: [row] }), TypeError);
});
