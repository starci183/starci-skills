import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// A child imports this module with the query flag below before it boots the generated API.
// The IPC message reports the port selected by the operating system when the app listens on 0.
if (new URL(import.meta.url).searchParams.has('server-ready')) {
  const listen = net.Server.prototype.listen;
  net.Server.prototype.listen = function listenAndReport(...args) {
    this.once('listening', () => {
      const address = this.address();
      if (address && typeof address === 'object' && typeof address.port === 'number') {
        process.send?.({ type: 'server-ready', port: address.port });
      }
    });
    return Reflect.apply(listen, this, args);
  };
}

export const SERVER_READY_IMPORT = (() => {
  const url = new URL(import.meta.url);
  url.searchParams.set('server-ready', '1');
  return url.href;
})();

const elapsed = (started) => Math.round((performance.now() - started) * 10) / 10;

/** Proves a fixture is made only of real files and directories, never links or junctions. */
function assertRealTree(root) {
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`scaffold baseline must not contain a link: ${path.relative(root, current)}`);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) pending.push(path.join(current, entry));
    }
  }
}

/**
 * Creates one locked scaffold lazily for this spec process. Every caller gets a real-file copy in
 * its own already-created `into` directory, so mutations and build output never reach another test.
 */
export function createScaffoldAppBaseline({ create }) {
  let baseline = null;
  let building = null;
  let clones = 0;

  const ensure = async () => {
    if (baseline) {
      console.log(`# scaffold baseline cache hit (${clones} clone${clones === 1 ? '' : 's'} served)`);
      return baseline;
    }
    if (!building) {
      const into = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-baseline-'));
      const started = performance.now();
      building = Promise.resolve(create(into)).then((created) => {
        assertRealTree(created.root);
        baseline = { into, created };
        console.log(`# scaffold baseline created in ${elapsed(started)}ms`);
        return baseline;
      }, (error) => {
        fs.rmSync(into, { recursive: true, force: true });
        building = null;
        throw error;
      });
    } else {
      console.log('# scaffold baseline cache hit (awaiting creation)');
    }
    return building;
  };

  return {
    async cloneInto(into) {
      const source = await ensure();
      const started = performance.now();
      const root = path.join(into, path.basename(source.created.root));
      fs.cpSync(source.created.root, root, { recursive: true, dereference: true, preserveTimestamps: true, errorOnExist: true, force: false });
      assertRealTree(root);
      clones += 1;
      console.log(`# scaffold baseline clone ${clones} created in ${elapsed(started)}ms`);
      return { ...source.created, root };
    },

    reset(into, prepare) {
      const started = performance.now();
      prepare?.();
      fs.rmSync(into, { recursive: true, force: true });
      console.log(`# scaffold fixture reset in ${elapsed(started)}ms`);
    },

    async close() {
      const source = baseline ?? (building ? await building.catch(() => null) : null);
      if (!source) return;
      const started = performance.now();
      fs.rmSync(source.into, { recursive: true, force: true });
      baseline = null;
      building = null;
      console.log(`# scaffold baseline reset in ${elapsed(started)}ms`);
    },
  };
}
