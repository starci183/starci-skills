// hide-child-windows.mjs — the child-process defaults for background Windows entry points.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { withWindowsHide } from './lib.mjs';

const MARK = Symbol.for('starci.hideChildWindows');

/**
 * Install process-wide hidden-window defaults for Windows child-process calls.
 * Explicit `windowsHide` options survive, and builtin ESM exports are synced
 * so their named imports use the wrappers. Importing this module installs the
 * patch; detached entry points load it before spawning to avoid visible consoles.
 * Returns true on the first Windows installation, false elsewhere or once patched.
 */
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
