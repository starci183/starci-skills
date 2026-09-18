import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { HttpException } from '@nestjs/common';
import { AppConfigService } from '../../platform/config';
import { IdentityApiClient } from './identity.client';

/**
 * sds.checkout.order-flow's sequence step "order -> identity: verify the bearer session" against
 * a real HTTP server on a real loopback socket, on a base URL that arrives exactly the way
 * production's does (AppConfigService.getIdentityApiBaseUrl() from metadata.json or its override).
 */
describe('IdentityApiClient - order calls identity over real HTTP', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/sessions/verify') {
        let raw = '';
        req.on('data', (chunk: Buffer) => {
          raw += chunk;
        });
        req.on('end', () => {
          const { sessionToken } = JSON.parse(raw) as { sessionToken?: string };
          if (sessionToken === 'live-token') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ personId: 'person-1' }));
          } else {
            res.writeHead(401, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ code: 'SESSION_INVALID' }));
          }
          return;
        });
        return;
      }
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  function clientFor(url: string): IdentityApiClient {
    return new IdentityApiClient({ getIdentityApiBaseUrl: () => url } as AppConfigService);
  }

  it('sds.checkout.order-flow verify-session: a live token answers with its person over real HTTP', async () => {
    expect(await clientFor(baseUrl).verifySession('live-token')).toEqual({ personId: 'person-1' });
  });

  it('sds.checkout.order-flow verify-session: a refused token is null for the consumer to turn into its own refusal', async () => {
    expect(await clientFor(baseUrl).verifySession('stale-token')).toBeNull();
  });

  it('sds.checkout.order-flow verify-session: an unreachable identity is a typed 503, never a pass-through', async () => {
    try {
      await clientFor('http://127.0.0.1:1').verifySession('live-token');
      throw new Error('the call should have failed');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'IDENTITY_SERVICE_UNAVAILABLE' });
    }
  });

  it('order health answers identity-unreachable when the provider is down', async () => {
    expect(await clientFor(baseUrl).isHealthy()).toBe(true);
    expect(await clientFor('http://127.0.0.1:1').isHealthy()).toBe(false);
  });
});
