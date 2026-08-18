---
title: External integrations
---

# External integrations

## Dùng khi

Dùng trang này khi enable hoặc rotate provider không do local Compose stack tạo. `scripts/credentials.mjs`
là mapping có thẩm quyền từ mục đích provider sang encrypted filename và application env key.

## Trước khi chạy

Tạo provider account/project trong console của nó, chọn sandbox/test mode trước, ghi callback hoặc webhook
URL của environment, và giữ issued value trong password manager cho tới khi lưu. Không dùng `secret:gen`;
repository không thể regenerate credential bên thứ ba.

## Secrets

| Family | Fixed encrypted records |
|---|---|
| PayOS / SePay | `payos-api-key.key.enc`, `sepay-api-key.key.enc`, `sepay-ipn-secret.key.enc` |
| Stripe | `stripe-secret-key.key.enc`, `stripe-webhook-secret.key.enc` |
| PayPal | `paypal-client-id.key.enc`, `paypal-client-secret.key.enc`, `paypal-webhook-id.key.enc` |
| NOWPayments | `nowpayments-api-key.key.enc`, `nowpayments-ipn-secret.key.enc` |
| GitHub/data | `github-access-token.key.enc`, `github-secret-key.key.enc`, optional `data-git-token.key.enc` |
| Keycloak app | `keycloak-client-secret.key.enc` |
| Remote S3 | `s3-secret-access-key.key.enc`; access-key ID và endpoints là non-secret config |
| Brevo | `brevo-smtp-api-key.key.enc` |
| GCP | `gcp-service-account.json.enc` |
| Grafana | `grafana-cloud-write-token.key.enc` |
| Judge0/admin/encryption | `judge0-auth-token.key.enc`, `admin-api-key.key.enc`, `encryption-key.key.enc` |
| AI pools | `openai-api-keys.key.enc`, `gemini-api-keys.key.enc`, `openrouter-api-keys.key.enc`, `anthropic-api-keys.key.enc`, optional `qwen7b.key.enc` |

## Chạy

Với opaque key:

```powershell
npm run secret:set -- dev/runtime/files/<fixed-name>.key
npm run sync
```

Với AI pool nhiều dòng, dùng multiline input và kết thúc bằng `Ctrl+Z`, rồi Enter trên Windows:

```powershell
npm run secret:set -- dev/runtime/files/openai-api-keys.key --multiline
npm run sync
```

Với Google service-account JSON đang ở protected download:

```powershell
npm run secret:set -- dev/runtime/files/gcp-service-account.json --from-file <protected-json-path>
npm run sync
```

Cấu hình non-secret endpoint, currency, sender identity, OAuth client ID, bucket/region và callback URL
trong encrypted app config theo environment. Không sửa default `config.ts` để cài một environment.

Provider-side minimum setup:

| Provider | Cấu hình trước verify |
|---|---|
| Stripe/PayPal/PayOS/SePay/NOWPayments | sandbox app/account, HTTPS webhook chính xác, signing secret/IPN key, currency hỗ trợ |
| Brevo | SMTP credential, verified sender/domain, from address/name |
| OpenAI/Gemini/OpenRouter/Anthropic | project key với spend/scope tối thiểu; mỗi key một dòng trong pool |
| DigitalOcean/S3 | bucket, region/endpoint, access-key ID, CORS/public-prefix policy |
| GCP service account | least-privilege role và chỉ enable API thật sự dùng |
| GitHub/data token | fine-grained repository access nếu có; mặc định không cấp classic scope toàn organization |

## Verify

Verify một thao tác provider an toàn trước live traffic: sandbox payment intent, signed webhook fixture,
SMTP test message, AI ping, S3 put/get/delete dưới test prefix, Google API read, hoặc private-repository
metadata read. Sau đó xem application log và provider audit log; không print credential.

```powershell
npm run secret:list
npm run sync
npm run lint:check
npm run test:unit
```

## Dừng hoặc rollback

Disable integration qua non-secret feature/config switch nếu có. Restore encrypted record cũ trước khi
revoke nếu replacement lỗi. Với payment webhook, giữ idempotency và signature verification trong rollback.

## Rotate

Issue replacement → ghi fixed encrypted record → publish deployed projection → restart consumer → chạy
một safe verification → revoke value cũ. Encryption key khác hẳn: rotate `encryption-key.key` cần data
re-encryption migration, không được xử lý như đổi API token.

## Troubleshoot

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| provider trả 401/403 | đúng account/environment, scope và fixed filename đã sync |
| webhook signature lỗi | raw body, đúng provider signing secret và đúng endpoint environment |
| AI pool trống | filename khớp catalog và keys tách bằng newline |
| SMTP auth được nhưng mail bị reject | verified sender/domain và from address |
| S3 upload được nhưng public URL 403 | public endpoint, bucket policy và allowed prefix |
| GCP báo thiếu ADC | service-account JSON projection và least-privilege API enablement |

## Upstream

Dùng tài liệu chính chủ hiện tại được link từ console từng provider. Reconfirm webhook và token scope trước
mọi production mutation; provider UI và tên scope thay đổi theo thời gian.
