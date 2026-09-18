import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { HttpException } from '@nestjs/common';
import { AppConfigService } from '../../platform/config';
import { OrderApiClient } from './order.client';

/**
 * The consumer half of contract.checkout.order-for-identity against a real HTTP server on a real
 * loopback socket - not a mocked fetch. The base URL travels exactly the way production's does
 * (through AppConfigService.getOrderApiBaseUrl(), resolved from metadata.json or its env override).
 */
describe('OrderApiClient - contract.checkout.order-for-identity consumer', () => {
  let server: Server;
  let baseUrl: string;
  let handler: (req: IncomingMessage, res: ServerResponse) => void;

  beforeAll(async () => {
    handler = (req, res) => handlerBody(req, res);
    server = createServer((req, res) => handler(req, res));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  function handlerBody(req: IncomingMessage, res: ServerResponse): void {
    void req;
    if (req.url === '/buyers/person-1') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ personId: 'person-1', hasOrders: true }));
      return;
    }
    if (req.url === '/buyers/person-2') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ personId: 'person-2', hasOrders: false }));
      return;
    }
    if (req.url === '/buyers/person-lies') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ hasOrders: true }));
      return;
    }
    res.writeHead(404).end();
  }

  function clientFor(url: string): OrderApiClient {
    const config = { getOrderApiBaseUrl: () => url } as AppConfigService;
    return new OrderApiClient(config);
  }

  it('contract.checkout.order-for-identity consumer: reads a buyer answer over real HTTP', async () => {
    const buyer = await clientFor(baseUrl).getBuyerStatus('person-1');
    expect(buyer).toEqual({ personId: 'person-1', hasOrders: true });
    const newcomer = await clientFor(baseUrl).getBuyerStatus('person-2');
    expect(newcomer.hasOrders).toBe(false);
  });

  it('contract.checkout.order-for-identity consumer: an answer outside the surface is refused, not trusted', async () => {
    await expect(clientFor(baseUrl).getBuyerStatus('person-lies')).rejects.toBeInstanceOf(HttpException);
  });

  it('contract.checkout.order-for-identity consumer: an unreachable provider is 503 ORDER_SERVICE_UNAVAILABLE, never hasOrders false', async () => {
    // Port 1 on loopback: connection refused, the exact shape of the provider being down.
    const client = clientFor('http://127.0.0.1:1');
    try {
      await client.getBuyerStatus('person-1');
      throw new Error('the call should have failed');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const body = (error as HttpException).getResponse() as { code: string };
      expect(body.code).toBe('ORDER_SERVICE_UNAVAILABLE');
    }
  });
});
