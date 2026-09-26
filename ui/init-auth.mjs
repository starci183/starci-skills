import { randomBytes, scryptSync } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const directory = path.join(root, '.secrets');
const file = path.join(directory, 'auth.json');
await mkdir(directory, { recursive: true });
const password = randomBytes(32).toString('base64url');
const salt = randomBytes(16).toString('hex');
const auth = { username: 'owner', salt, hash: scryptSync(password, salt, 32).toString('hex') };
const handle = await open(file, 'wx', 0o600);
try { await handle.writeFile(JSON.stringify(auth) + '\n'); } finally { await handle.close(); }
console.log(`Tên đăng nhập: ${auth.username}\nMật khẩu một lần: ${password}`);
