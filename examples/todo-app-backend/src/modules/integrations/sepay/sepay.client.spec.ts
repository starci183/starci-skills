import { AppConfigService } from '../../platform/config';
import { SepayClient } from './sepay.client';

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
