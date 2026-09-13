import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {BUILT_IN_HOSTS,HOSTS_PROFILE,HOST_NAMES,assertHosts,hostDescriptor,loadHosts,validateHosts} from '../hosts/index.mjs';
import {ORCA_HOST} from '../hosts/orca/calls.mjs';
import {HEADLESS_HOST} from '../hosts/headless/host.mjs';

// The host model is declared data: `model/hosts.yaml` is the whole of what the kernel knows about a host, and
// the two adapters read their own descriptor from it instead of each holding a constant that can drift.
const read=name=>parseYaml(fs.readFileSync(new URL(`../model/${name}`,import.meta.url),'utf8'));
const profile=read('hosts.yaml');
const kinds=read('kinds.yaml');
const codes=errors=>errors.map(error=>error.code);
const clone=()=>structuredClone(profile);
const plainHost=host=>({name:host.name,capabilities:[...host.capabilities],sequential:host.sequential});

test('the shipped host profile validates against the real kinds capability vocabulary',()=>{
  assert.equal(profile.schema,HOSTS_PROFILE);
  assert.deepEqual(validateHosts(profile,{kinds}),[]);
  assert.equal(assertHosts(profile,{kinds}),profile);
  assert.deepEqual(Object.keys(profile.hosts).sort(),[...HOST_NAMES].sort());
  for(const name of HOST_NAMES){
    const entry=profile.hosts[name];
    // A host says what it offers beyond a worktree and a runtime, and why it exists, in words a reader keeps.
    assert.ok(typeof entry.purpose==='string'&&entry.purpose.trim().length>20,`${name} declares a purpose`);
    assert.equal(typeof entry.sequential,'boolean',name);
    for(const capability of entry.capabilities)assert.ok(kinds.vocabularies.capabilities.includes(capability),capability);
  }
  // Every capability a kind may need has a host that offers it, or the kind could never be scheduled anywhere.
  const offered=new Set(Object.values(profile.hosts).flatMap(entry=>entry.capabilities));
  for(const record of Object.values(kinds.kinds))for(const capability of record.needs??[])assert.ok(offered.has(capability),capability);
});

test('each adapter describes itself exactly as the profile declares it',()=>{
  assert.deepEqual(plainHost(ORCA_HOST),{name:'orca',capabilities:[...profile.hosts.orca.capabilities],sequential:profile.hosts.orca.sequential});
  assert.deepEqual(plainHost(HEADLESS_HOST),{name:'headless',capabilities:[...profile.hosts.headless.capabilities],sequential:profile.hosts.headless.sequential});
  // The descriptor is the only shape the kernel reads, so the two hosts carry the same three keys and nothing more.
  assert.deepEqual(Object.keys(ORCA_HOST).sort(),['capabilities','name','sequential']);
  assert.deepEqual(Object.keys(HEADLESS_HOST).sort(),Object.keys(ORCA_HOST).sort());
  assert.ok(Object.isFrozen(ORCA_HOST)&&Object.isFrozen(HEADLESS_HOST));
  for(const name of HOST_NAMES){
    assert.deepEqual(hostDescriptor(name,{profile}),{name,capabilities:[...profile.hosts[name].capabilities],sequential:profile.hosts[name].sequential});
    // The built-in fallback is what an adapter answers with before a build exists; it may never say something
    // else than the profile, or a host would describe itself differently depending on whether `.dist` is there.
    assert.deepEqual(plainHost(BUILT_IN_HOSTS[name]),hostDescriptor(name,{profile}));
  }
  // A descriptor owns its own array: a caller that keeps one cannot reach back into the cached profile.
  const descriptor=hostDescriptor('orca',{profile});
  descriptor.capabilities.push('invented');
  assert.deepEqual(hostDescriptor('orca',{profile}).capabilities,[...profile.hosts.orca.capabilities]);
  assert.throws(()=>hostDescriptor('nowhere',{profile}),/Unknown host nowhere/);
});

test('the authored profile is loaded from its directory and a bad profile is rejected by code',()=>{
  assert.deepEqual(loadHosts({profileDir:path.join(import.meta.dirname,'..','model')}),profile);
  // The compiled copy is what the runtime reads, so the build must carry the new profile into `.dist`.
  assert.deepEqual(loadHosts(),JSON.parse(JSON.stringify(profile)));
  assert.deepEqual(codes(validateHosts({schema:HOSTS_PROFILE},{kinds})),['host-shape']);
  assert.deepEqual(codes(validateHosts({schema:'starci/hosts@9',hosts:profile.hosts},{kinds})),['profile-schema']);

  // A capability the kinds vocabulary does not declare is a promise no kind will ever ask for: the host reads
  // as though it offers something and offers nothing, so it is refused here rather than at schedule time.
  const invented=clone();invented.hosts.orca.capabilities=['design-tool','time-machine'];
  assert.deepEqual(codes(validateHosts(invented,{kinds})),['unknown-host-capability']);

  const shapes=[
    ['orca',entry=>{entry.capabilities='design-tool';}],
    ['headless',entry=>{delete entry.sequential;}],
    ['headless',entry=>{entry.purpose='   ';}]
  ];
  for(const [name,break_] of shapes){
    const broken=clone();break_(broken.hosts[name]);
    assert.deepEqual(codes(validateHosts(broken,{kinds})),['host-shape'],name);
  }
  // Both adapters must find themselves here: a missing entry leaves that adapter on its built-in fallback,
  // which is the silent drift this profile exists to prevent.
  const missing=clone();delete missing.hosts.headless;
  assert.deepEqual(codes(validateHosts(missing,{kinds})),['host-shape']);
  const extra=clone();extra.hosts.mainframe={capabilities:[],sequential:true,purpose:'a host with no adapter behind it'};
  assert.deepEqual(codes(validateHosts(extra,{kinds})),['host-shape']);
  assert.throws(()=>assertHosts(invented,{kinds}),/Invalid hosts profile/);
});
