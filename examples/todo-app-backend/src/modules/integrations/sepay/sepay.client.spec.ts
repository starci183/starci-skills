import { AppConfigService } from '../../platform/config';
import { SepayClient } from './sepay.client';

function gatewayResponse(status: number, body: string): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => body } as unknown as Response;
}

function clientWith(apiKey: string): SepayClient {
  const config = new AppConfigService();
  jest.spyOn(config, 'getSepayBaseUrl').mockReturnValue('https://my.sepay.vn');
  jest.spyOn(config, 'getSepayApiKey').mockReturnValue(apiKey);
  return new SepayClient(config);
}

describe('SepayClient.assertWebhookAuthorized', () => {
  it("fr.plan.upgrade's invalid-signature exception flow: a missing or wrong Authorization header is refused", () => {
    process.env.SEPAY_WEBHOOK_SECRET_FILE = '';
    const client = new SepayClient(new AppConfigService());
    expect(() => client.assertWebhookAuthorized(undefined)).toThrow(expect.objectContaining({ code: 'PLAN_WEBHOOK_UNAUTHORIZED' }));
    expect(() => client.assertWebhookAuthorized('Bearer wrong-secret')).toThrow(
      expect.objectContaining({ code: 'PLAN_WEBHOOK_UNAUTHORIZED' }),
    );
  });

  it('a matching Authorization header is accepted', () => {
    const configured = new AppConfigService();
    jest.spyOn(configured, 'getSepayWebhookSecret').mockReturnValue('the-real-secret');
    const client = new SepayClient(configured);
    expect(() => client.assertWebhookAuthorized('Bearer the-real-secret')).not.toThrow();
  });
});

describe('SepayClient.createIntent (integration.plan.sepay)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reports the gateway status of a failed call instead of a JSON parse error', async () => {
    // Measured on the real host 2026-09-18: the create-intent path answers 404 with an empty body, and
    // parsing that body before reading the status threw SyntaxError, hiding the one fact that mattered.
    jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(404, ''));
    await expect(clientWith('a-key').createIntent({ subscriptionId: 'sub-1', amount: 99000, currency: 'VND' }))
      .rejects.toThrow(/empty body \(HTTP 404/);
  });

  it('names whether a credential went out at all, never its value', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(401, ''));
    await expect(clientWith('').createIntent({ subscriptionId: 'sub-1', amount: 99000, currency: 'VND' }))
      .rejects.toThrow(/no credential is configured/);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ authorization: 'Bearer ' });

    await expect(clientWith('a-real-key').createIntent({ subscriptionId: 'sub-1', amount: 99000, currency: 'VND' }))
      .rejects.toThrow(/a credential was sent/);
  });

  it('carries the gateway\'s own transaction id and checkout url through unchanged', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(200, JSON.stringify({ id: 'TN9', qrCodeUrl: 'https://pay.example/qr/TN9' })));
    await expect(clientWith('a-key').createIntent({ subscriptionId: 'sub-1', amount: 99000, currency: 'VND' }))
      .resolves.toEqual({ gatewayIntentId: 'TN9', checkoutUrl: 'https://pay.example/qr/TN9' });
  });

  it('refuses a success response that names no transaction', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(200, JSON.stringify({ message: 'ok' })));
    await expect(clientWith('a-key').createIntent({ subscriptionId: 'sub-1', amount: 99000, currency: 'VND' }))
      .rejects.toThrow(/no transaction id and checkout url/);
  });

  it('refuses a gateway answer that is not JSON at all', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(200, '<html>gateway said no</html>'));
    await expect(clientWith('a-key').createIntent({ subscriptionId: 'sub-1', amount: 99000, currency: 'VND' }))
      .rejects.toThrow(/body that is not JSON \(<html>gateway said no<\/html>\)/);
  });
});

describe('SepayClient.getTransaction (sds.plan.reconciliation)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('refuses a status outside the closed vocabulary rather than casting it into one', async () => {
    // Any status that is not 'pending' or 'failed' reaches ConfirmPaymentHandler as a paid activation,
    // so a value this product does not know must never become one by a cast.
    jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(200, JSON.stringify({ status: 'refunded' })));
    await expect(clientWith('a-key').getTransaction('TN9')).rejects.toThrow(/unrecognised status "refunded"/);
  });

  it('reads the gateway\'s paid status and its period end', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(200, JSON.stringify({ status: 'paid', periodEnd: '2027-01-01T00:00:00.000Z' })));
    await expect(clientWith('a-key').getTransaction('TN9')).resolves.toEqual({
      status: 'paid',
      periodEnd: new Date('2027-01-01T00:00:00.000Z'),
    });
  });

  it('refuses a period end it cannot read as a date', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(200, JSON.stringify({ status: 'paid', periodEnd: 'next tuesday' })));
    await expect(clientWith('a-key').getTransaction('TN9')).rejects.toThrow(/unreadable periodEnd \("next tuesday"\)/);
  });

  it('keeps a gateway intent id inside its own path segment', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(gatewayResponse(200, JSON.stringify({ status: 'pending' })));
    await clientWith('a-key').getTransaction('TN9/../admin');
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://my.sepay.vn/userapi/transactions/details/TN9%2F..%2Fadmin');
  });

  it('reports a gateway that never answers as a timeout', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(
      Object.assign(new Error('This operation was aborted'), { name: 'TimeoutError' }),
    );
    await expect(clientWith('a-key').getTransaction('TN9')).rejects.toThrow(/timed out after 15000ms/);
  });

  it('reports the real cause of a request that could not be made', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('no route'), { code: 'ENOTFOUND' }) }),
    );
    await expect(clientWith('a-key').getTransaction('TN9')).rejects.toThrow(/did not complete \(ENOTFOUND\).*HTTP no response/s);
  });
});
