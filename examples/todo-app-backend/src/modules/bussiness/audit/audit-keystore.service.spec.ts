import { createFakeAuditEntityManager } from './testing/fake-audit-entity-manager';
import { AuditKeystoreService } from './audit-keystore.service';

const buildService = () => new AuditKeystoreService(createFakeAuditEntityManager() as never);

describe('AuditKeystoreService', () => {
  it('getOrCreateKey mints a key on first use and returns the same key on later calls', async () => {
    const keystore = buildService();

    const first = await keystore.getOrCreateKey('person-1');
    const second = await keystore.getOrCreateKey('person-1');

    expect(second.keyId).toBe(first.keyId);
    expect(second.key.equals(first.key)).toBe(true);
  });

  it('seal/unseal round-trips a plaintext under the same key', async () => {
    const keystore = buildService();
    const { key } = await keystore.getOrCreateKey('person-1');

    const sealed = keystore.seal(key, 'person-1');

    expect(sealed).not.toContain('person-1');
    expect(keystore.unseal(key, sealed)).toBe('person-1');
  });

  it('unseal returns null, never throws, for a tampered or wrongly-keyed blob', async () => {
    const keystore = buildService();
    const { key } = await keystore.getOrCreateKey('person-1');
    const { key: otherKey } = await keystore.getOrCreateKey('person-2');
    const sealed = keystore.seal(key, 'person-1');

    expect(keystore.unseal(otherKey, sealed)).toBeNull();
    expect(keystore.unseal(key, 'not-a-sealed-value')).toBeNull();
  });

  it('br.audit.erasure.right / decision.audit.erasure-method: destroyKey removes the key and the personId-to-keyId mapping together', async () => {
    const keystore = buildService();
    const { keyId } = await keystore.getOrCreateKey('person-1');

    await keystore.destroyKey('person-1');

    expect(await keystore.getKeyIdForPerson('person-1')).toBeNull();
    expect(await keystore.getKeyMaterial(keyId)).toBeNull();
  });

  it('getKeyIdForPerson never creates a key as a side effect of a read', async () => {
    const keystore = buildService();

    expect(await keystore.getKeyIdForPerson('never-seen')).toBeNull();
    expect(await keystore.getKeyIdForPerson('never-seen')).toBeNull();
  });
});
