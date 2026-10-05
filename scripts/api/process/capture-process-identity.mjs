// The capture-only native process call; custody and receipt mechanics stay in the shared call engine.
import { ownedProcess as call } from './owned-process.mjs';

/** Capture the actual live process object at an owned launch; optional nonce proves an owned child's inherited launch environment. */
export function captureProcessIdentity(pid, options = {}) { return call(pid, { ...options, identity: null }); }
