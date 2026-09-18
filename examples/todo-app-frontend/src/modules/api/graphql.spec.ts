import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { graphql } from './graphql';

describe('graphql', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends the document, variables and x-session-token header, and unwraps the one top-level field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ data: { tasks: [{ taskId: 't-1', title: 'Ship it', complete: false }] } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await graphql<unknown>('query { tasks { taskId } }', { foo: 'bar' }, 'token-1');

    expect(result).toEqual({ ok: true, data: [{ taskId: 't-1', title: 'Ship it', complete: false }] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/graphql');
    expect(init.method).toBe('POST');
    expect(init.headers['x-session-token']).toBe('token-1');
    expect(JSON.parse(init.body)).toEqual({ query: 'query { tasks { taskId } }', variables: { foo: 'bar' } });
  });

  it('omits the x-session-token header when no token is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ data: { signIn: { sessionToken: 'x' } } }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await graphql('mutation { signIn }');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['x-session-token']).toBeUndefined();
  });

  it('turns a GraphQL error into a refused Result carrying its extensions.code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ errors: [{ message: 'The email or password is incorrect.', extensions: { code: 'INVALID_CREDENTIALS' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await graphql('mutation { signIn }');

    expect(result).toEqual({ ok: false, reason: 'The email or password is incorrect.', code: 'INVALID_CREDENTIALS' });
  });

  it('never throws on a network failure; it resolves a refused Result instead', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    const result = await graphql('query { tasks { taskId } }');

    expect(result).toEqual({ ok: false, reason: 'network', code: 'NETWORK' });
  });

  it('reports a malformed (non-JSON) response as a refused Result rather than throwing', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => { throw new Error('not json'); } }) as unknown as typeof fetch;

    const result = await graphql('query { tasks { taskId } }');

    expect(result).toEqual({ ok: false, reason: 'malformed', code: 'MALFORMED' });
  });

  it('reports a response with no data field as empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({}) }) as unknown as typeof fetch;

    const result = await graphql('query { tasks { taskId } }');

    expect(result).toEqual({ ok: false, reason: 'empty', code: 'EMPTY' });
  });
});
