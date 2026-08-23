---
title: OAuth
---

# OAuth: Keycloak, Google và GitHub

## Dùng khi

Dùng trang này khi local hoặc deployed environment cần Google/GitHub sign-in qua Keycloak, khi OAuth
client rotate, hoặc login lỗi redirect/state/client.

## Trước khi chạy

Start local stack và xác nhận Keycloak/API reachable:

```powershell
npm run compose
npm run start:dev
Invoke-WebRequest http://localhost:8081/realms/master
```

Local fact do repository derive:

- Keycloak: `http://localhost:8081`, realm `master`, client `academy-web`.
- API Google callback: `http://localhost:3001/api/v1/keycloak/google/callback`.
- API GitHub broker callback: `http://localhost:3001/api/v1/keycloak/github/callback`.
- Direct GitHub account-link callback: `http://localhost:3001/api/v1/github/oauth/callback`.

Production phải thay host/scheme bằng public HTTPS endpoint; path, chữ hoa/thường và trailing slash phải
khớp tuyệt đối.

## Secrets

Google client secret thuộc Keycloak identity-provider config, không thuộc source. Direct GitHub OAuth
secret nằm ở `github-secret-key.key.enc`; Keycloak GitHub broker secret nằm trong Keycloak. Không ghi client
secret vào `app.env`, README hoặc OAuth URL.

## Chạy

### Keycloak client

Mở `http://localhost:8081/admin`, đăng nhập bằng generated admin credential, chọn realm `master`, rồi
tạo/cấu hình client `academy-web`:

- Client type: OpenID Connect.
- Standard flow: enabled.
- Valid redirect URIs: hai API Keycloak callback ở trên.
- Web origins: frontend development origin, đúng scheme/host/port.
- PKCE: S256 nếu client setting có tùy chọn này.

### Google provider

1. Trong Google Cloud, tạo/chọn project và cấu hình OAuth consent screen.
2. Tạo OAuth client loại **Web application**.
3. Thêm Keycloak broker endpoint làm authorized redirect URI:

   `http://localhost:8081/realms/master/broker/google/endpoint`

4. Trong Keycloak: `Identity providers` → `Google`; nhập Google client ID/secret và enable.
5. Alias phải đúng `google`, khớp `kc_idp_hint=google` trong source.

### GitHub provider

1. Tạo GitHub OAuth App cho environment.
2. Với Keycloak broker app, callback là:

   `http://localhost:8081/realms/master/broker/github/endpoint`

3. Trong Keycloak: `Identity providers` → `GitHub`; nhập app client ID/secret và giữ alias `github`.
4. Nếu dùng direct GitHub account linking, tạo/cấu hình OAuth App với callback
   `http://localhost:3001/api/v1/github/oauth/callback`; lưu secret:

```powershell
npm run secret:set -- dev/runtime/files/github-secret-key.key
npm run sync
```

Đặt non-secret client ID/redirect override qua encrypted app config theo environment, không sửa default
trong `config.ts`.

## Verify

1. Mở API Google redirect endpoint kèm frontend `redirect_uri` parameter.
2. Browser phải đi API → Keycloak → Google → Keycloak broker endpoint → API callback.
3. Callback trả application token và tạo/cập nhật đúng một local user với Google auth type.
4. Lặp lại với GitHub; verify GitHub username được lưu nếu provider trả về.
5. Xem API/Keycloak log cho state expiration, client hoặc redirect error; không log authorization code.

## Dừng hoặc rollback

Disable Keycloak identity provider để dừng login mới mà không xóa linked user. Re-enable OAuth client/secret
cũ trước khi revoke replacement chưa verify được.

## Rotate

Tạo replacement client secret, update Keycloak hoặc encrypted direct-GitHub record, restart/sync, hoàn tất
một login, rồi revoke secret cũ. Khi đổi redirect domain, phải update Google/GitHub provider, Keycloak
client redirects, app callback variables và frontend origin trong cùng release.

## Troubleshoot

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| Google `redirect_uri_mismatch` | Google URI phải là Keycloak `/broker/google/endpoint`, khớp từng ký tự |
| Keycloak `Client not found` | realm/client ID và Keycloak volume còn giữ |
| callback trả invalid code | API callback đã đăng ký trong Keycloak client và token exchange dùng cùng redirect |
| state expired/missing | bắt đầu lại từ redirect endpoint; không reuse callback URL cũ |
| hiện màn chọn provider | IdP alias phải khớp `google` hoặc `github` |
| production login vòng về localhost | environment callback overrides chưa được publish |

## Upstream

- [Google OAuth web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Keycloak identity brokering](https://www.keycloak.org/docs/latest/server_admin/#_identity_broker)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
