import {
  createCipheriv, createHash, createHmac, createPrivateKey, createPublicKey,
  diffieHellman, hkdfSync, randomBytes,
} from 'node:crypto';

// Bootstrap only; interoperable with https://c2sp.org/age and getsops/sops.
// See SOPS aes/cipher.go, sops.go, stores/dotenv/store.go, stores/flatten.go.
const ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const PRIVATE_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');
const PUBLIC_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');

function checksumStep(checksum, value) {
  const top = checksum >>> 25;
  let next = ((checksum & 0x1ffffff) << 5) ^ value;
  for (let bit = 0; bit < 5; bit += 1) {
    if ((top >>> bit) & 1) next ^= GENERATORS[bit];
  }
  return next >>> 0;
}

function checksumWords(prefix, words) {
  const codes = [...prefix].map((character) => character.codePointAt(0));
  const expanded = [...codes.map((code) => code >>> 5), 0, ...codes.map((code) => code & 31)];
  return [...expanded, ...words].reduce((checksum, value) => checksumStep(checksum, value), 1);
}

function convertBits(input, from, to, pad) {
  let accumulator = 0;
  let bits = 0;
  const result = [];
  const mask = (1 << to) - 1;
  for (const value of input) {
    accumulator = ((accumulator << from) | value) & 0xffff;
    bits += from;
    while (bits >= to) {
      bits -= to;
      result.push((accumulator >>> bits) & mask);
    }
  }
  if (pad && bits) result.push((accumulator << (to - bits)) & mask);
  if (!pad && (bits >= from || ((accumulator << (to - bits)) & mask))) {
    throw new Error('Invalid age recipient encoding');
  }
  return result;
}

function bech32Encode(prefix, bytes) {
  const words = convertBits(bytes, 8, 5, true);
  const checksum = checksumWords(prefix, [...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const suffix = [];
  for (let index = 0; index < 6; index += 1) suffix.push((checksum >>> (5 * (5 - index))) & 31);
  return prefix + '1' + [...words, ...suffix].map((word) => ALPHABET[word]).join('');
}

function decodeRecipient(recipient) {
  if (typeof recipient !== 'string' || !recipient.startsWith('age1') || recipient.length !== 62) {
    throw new Error('Bootstrap requires an X25519 age recipient');
  }
  const words = Array.from(recipient.slice(4), (character) => ALPHABET.indexOf(character));
  if (words.includes(-1) || checksumWords('age', words) !== 1) {
    throw new Error('Invalid age recipient checksum');
  }
  const decoded = Buffer.from(convertBits(words.slice(0, -6), 5, 8, false));
  if (decoded.length !== 32) throw new Error('Invalid age recipient length');
  return decoded;
}

function privateKey(bytes) {
  const encoded = Buffer.concat([PRIVATE_PREFIX, bytes]);
  try {
    return createPrivateKey({ key: encoded, type: 'pkcs8', format: 'der' });
  } finally {
    encoded.fill(0);
  }
}

function publicBytes(key) {
  return createPublicKey(key).export({ type: 'spki', format: 'der' }).subarray(-32);
}

/** Return a fresh app identity in memory. The caller owns custody and zeroing. */
export function generateAppIdentity() {
  const seed = randomBytes(32);
  try {
    const recipient = bech32Encode('age', publicBytes(privateKey(seed)));
    const identity = Buffer.from(bech32Encode('age-secret-key-', seed).toUpperCase());
    return { identity, recipient };
  } finally {
    seed.fill(0);
  }
}

function deriveKey(secret, salt, info) {
  return Buffer.from(hkdfSync('sha256', secret, salt, info, 32));
}

function chachaSeal(plaintext, key, nonce) {
  const cipher = createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
  return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
}

function rawBase64(bytes) {
  return bytes.toString('base64').replaceAll('=', '');
}

function wrapFileKey(fileKey, recipient) {
  const seed = randomBytes(32);
  const ephemeral = privateKey(seed);
  seed.fill(0);
  const share = publicBytes(ephemeral);
  const peer = createPublicKey({ key: Buffer.concat([PUBLIC_PREFIX, recipient]), type: 'spki', format: 'der' });
  const sharedSecret = diffieHellman({ privateKey: ephemeral, publicKey: peer });
  const wrapKey = deriveKey(sharedSecret, Buffer.concat([share, recipient]), 'age-encryption.org/v1/X25519');
  try {
    const body = rawBase64(chachaSeal(fileKey, wrapKey, Buffer.alloc(12)));
    return '-> X25519 ' + rawBase64(share) + '\n' + body + '\n';
  } finally {
    sharedSecret.fill(0);
    wrapKey.fill(0);
  }
}

function ageSealDataKey(dataKey, recipient) {
  const fileKey = randomBytes(16);
  const nonce = randomBytes(16);
  const headerKey = deriveKey(fileKey, Buffer.alloc(0), 'header');
  const payloadKey = deriveKey(fileKey, nonce, 'payload');
  try {
    const header = 'age-encryption.org/v1\n' + wrapFileKey(fileKey, recipient) + '---';
    const mac = rawBase64(createHmac('sha256', headerKey).update(header).digest());
    const chunkNonce = Buffer.alloc(12);
    chunkNonce[11] = 1;
    const ciphertext = chachaSeal(dataKey, payloadKey, chunkNonce);
    return Buffer.concat([Buffer.from(header + ' ' + mac + '\n'), nonce, ciphertext]);
  } finally {
    fileKey.fill(0);
    headerKey.fill(0);
    payloadKey.fill(0);
  }
}

function armor(bytes) {
  const encoded = bytes.toString('base64');
  const lines = [];
  for (let offset = 0; offset < encoded.length; offset += 64) lines.push(encoded.slice(offset, offset + 64));
  return ['-----BEGIN AGE ENCRYPTED FILE-----', ...lines, '-----END AGE ENCRYPTED FILE-----', ''].join('\n');
}

function sopsEncrypt(value, dataKey, additionalData) {
  const iv = randomBytes(32);
  const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
  cipher.setAAD(Buffer.from(additionalData));
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return 'ENC[AES256_GCM,data:' + data.toString('base64') + ',iv:' + iv.toString('base64')
    + ',tag:' + cipher.getAuthTag().toString('base64') + ',type:str]';
}

function bootstrapEntries(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('Bootstrap values must be a dotenv key/value object');
  }
  const entries = Object.entries(values);
  if (!entries.length) throw new Error('Bootstrap requires at least one value');
  for (const [name, value] of entries) {
    if (!/^[A-Za-z_]\w*$/.test(name) || name.startsWith('sops_') || name.endsWith('_unencrypted')) {
      throw new Error('Bootstrap contains an invalid or reserved dotenv key');
    }
    if (typeof value !== 'string' || !value.length) throw new Error('Bootstrap values must be nonempty strings');
  }
  return entries;
}

/** Encrypt bootstrap values to the app's public key; no private key is needed. */
export function sealBootstrapValues({ values, recipient }) {
  const entries = bootstrapEntries(values);
  const recipientBytes = decodeRecipient(recipient);
  const dataKey = randomBytes(32);
  try {
    const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const digest = createHash('sha512');
    const lines = entries.map(([name, value]) => {
      digest.update(value, 'utf8');
      return name + '=' + sopsEncrypt(value, dataKey, name + ':');
    });
    const mac = sopsEncrypt(digest.digest('hex').toUpperCase(), dataKey, modified);
    const wrapped = armor(ageSealDataKey(dataKey, recipientBytes)).replaceAll('\n', String.raw`\n`);
    lines.push(
      'sops_age__list_0__map_enc=' + wrapped,
      'sops_age__list_0__map_recipient=' + recipient,
      'sops_lastmodified=' + modified,
      'sops_mac=' + mac,
      'sops_unencrypted_suffix=_unencrypted',
      'sops_version=3.9.4',
    );
    return lines.join('\n') + '\n';
  } finally {
    dataKey.fill(0);
  }
}
