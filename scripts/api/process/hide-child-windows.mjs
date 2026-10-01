// scripts/api/process/hide-child-windows.mjs — every child process this Node process
// starts gets windowsHide: true unless the call says otherwise.
//
// Why: the runtime's background processes (watchdog, ask-gateway, tunnel,
// serve-ask, telegram-bridge) are launched detached, which on Windows means
// DETACHED_PROCESS: no console at all. Each console program such a process
// then runs (orca.exe, powershell, taskkill, node) opens a NEW console window
// unless its own spawn passes windowsHide — the owner saw black windows flash
// on every watchdog tick. A child started hidden owns a hidden console that its
// own children inherit, so hiding at this one level is enough.
//
// Import it first in a detached entry point. It patches node:child_process and
// re-syncs the builtin ESM exports, so every module's
// `import { spawnSync } from 'node:child_process'` binding sees the patch.
// No-op off Windows; idempotent.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { withWindowsHide } from './lib.mjs';

const MARK = Symbol.for('starci.hideChildWindows');

export function hideChildWindows({ platform = process.platform } = {}) {
  if (platform !== 'win32' || cp[MARK]) return false;
  for (const [name, hasArgv] of [['spawn', true], ['spawnSync', true], ['execFile', true], ['execFileSync', true], ['exec', false], ['execSync', false]]) {
    const original = cp[name];
    const wrapped = function (...list) { return original.apply(this, withWindowsHide(list, hasArgv)); };
    for (const key of Reflect.ownKeys(original)) {
      if (key === 'length' || key === 'name' || key === 'prototype') continue;
      try { Object.defineProperty(wrapped, key, Object.getOwnPropertyDescriptor(original, key)); } catch { /* non-configurable */ }
    }
    cp[name] = wrapped;
  }
  cp[MARK] = true;
  syncBuiltinESMExports();
  return true;
}

hideChildWindows();
