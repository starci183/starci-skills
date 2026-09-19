/**
 * Lane v7-10 probe: which next-intl module instance does each importer actually get?
 * The shop app's provider lives in examples/ecommerce-app-fe; @fe-kit/* resolves to
 * <host>/packages/fe-kit/src. If those two resolve to different next-intl installs, the
 * NextIntlClientProvider context and next-intl's own hooks are two different React contexts
 * and every rendered page throws "No intl context found".
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const host = 'D:/Repositories/starci-academy-backend/.claude';
const fe = `${host}/examples/ecommerce-app-fe`;
const fromFe = createRequire(path.join(fe, 'noop.js'));
const fromKit = createRequire(path.join(host, 'packages', 'fe-kit', 'src', 'noop.js'));
const fromShared = createRequire(path.join(fe, 'packages', 'shared', 'src', 'noop.js'));

const show = (label, req) => {
  try {
    const pkg = req.resolve('next-intl/package.json');
    const version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
    console.log(`${label}: next-intl@${version} at ${pkg}`);
  } catch (error) {
    console.log(`${label}: cannot resolve next-intl (${String(error.code ?? error.message)})`);
  }
};
show('from examples/ecommerce-app-fe', fromFe);
show('from <host>/packages/fe-kit/src', fromKit);
show('from examples/ecommerce-app-fe/packages/shared/src', fromShared);

for (const [label, dir] of [
  ['<host>/packages/fe-kit', path.join(host, 'packages', 'fe-kit')],
  ['<host>/packages/fe-kit/node_modules', path.join(host, 'packages', 'fe-kit', 'node_modules')],
  ['<host>/node_modules/next-intl', path.join(host, 'node_modules', 'next-intl')],
  ['<host>/packages/node_modules', path.join(host, 'packages', 'node_modules')],
]) console.log(`${label}: ${fs.existsSync(dir) ? 'EXISTS' : 'absent'}`);
