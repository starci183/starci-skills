import test from 'node:test';
import assert from 'node:assert/strict';
import {headlessProvidersFromRegistry,HEADLESS_PROVIDERS} from '../models/functions.mjs';
import {providerFor} from '../hosts/headless/host.mjs';

test('Luna headless dispatch preserves the explicitly selected registered model',()=>{
  const provider=providerFor({agent:'codex',model:'gpt-5.6-luna'});
  assert.equal(provider.id,'gpt-5.6-luna');assert.equal(provider.model,'gpt-5.6-luna');
  assert.deepEqual(provider.command,['codex','exec','--json','--model','gpt-5.6-luna']);
  assert.equal(HEADLESS_PROVIDERS['claude-agent'].command.at(-1),'claude-opus-5');
});

test('a newly registered model uses its provider adapter without adding a model-specific code branch',()=>{
  const registry={targets:{newModel:{runtime:'codex',requestedModel:'fixture-future-model',profiles:{working:'future'}},
    profiled:{runtime:'claude',requestedModel:null,profiles:{reasoning:'reasoning'}},headless:{runtime:'claude',requestedModel:null,headlessModel:'fixture-headless-model'},unknown:{runtime:'unsupported',requestedModel:'do-not-invent'},missing:{runtime:'codex',profiles:{working:'absent'}}}};
  const providers=headlessProvidersFromRegistry(registry,{claude:{profiles:{reasoning:{model:'fixture-exact-model'}}}});
  assert.deepEqual(Object.keys(providers).sort(),['headless','newModel','profiled']);
  assert.equal(providerFor({agent:'codex',model:'fixture-future-model'},providers).id,'newModel');
  assert.equal(providerFor({agent:'claude',model:'fixture-exact-model'},providers).id,'profiled');
  assert.equal(providerFor({agent:'codex',model:'arbitrary-unregistered'},providers),null);
});
