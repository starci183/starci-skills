'use strict';

const net = require('node:net');
const crypto = require('node:crypto');

/** Asks the OS for `count` distinct free loopback ports, then releases each listener immediately. */
async function freePorts(count) {
  const servers = [];
  try {
    for (let i = 0; i < count; i += 1) {
      const server = net.createServer();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      servers.push(server);
    }
    return servers.map((server) => server.address().port);
  } finally {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  }
}

/** A run-scoped opaque token: unique compose project/volume names and per-run secret material. */
function runToken(bytes = 6) {
  return crypto.randomBytes(bytes).toString('hex');
}

function secret(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryUntil(label, deadlineMs, probe) {
  const startedAt = Date.now();
  let lastError = 'no attempt recorded';
  while (Date.now() - startedAt < deadlineMs) {
    try {
      const ok = await probe();
      if (ok) return { label, waitedMs: Date.now() - startedAt };
    } catch (error) {
      lastError = String(error?.stderr ?? error?.message ?? error).trim().split('\n').pop();
    }
    await sleep(1000);
  }
  const failure = new Error(`readiness timeout after ${deadlineMs}ms for ${label}: ${lastError}`);
  failure.label = label;
  throw failure;
}

module.exports = { freePorts, runToken, secret, sleep, retryUntil };
