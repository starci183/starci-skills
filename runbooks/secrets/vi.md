---
title: Secrets
---

# Secrets

## Dùng khi

Dùng trang này trên máy mới, khi provider cấp token mới, khi thiếu stack record, hoặc khi phải rotate
credential mà không để value lọt vào source, shell history hay terminal output.

## Trước khi chạy

```powershell
sops --version
age --version
Test-Path "$env:USERPROFILE\.starci\master.identity"
git status --short
```

Identity check phải trả `True`; restore đúng identity đang có từ password manager, không tạo identity
mới. Dừng nếu worktree đã có plaintext credential không giải thích được.

## Secrets

Map có thẩm quyền là `scripts/credentials.mjs`:

- `CREDENTIALS` là value hạ tầng repository được phép tự mint.
- `DERIVED_CREDENTIALS` được dựng lại từ value đã mint.
- `APP_CREDENTIALS` do bên thứ ba cấp và operator phải cung cấp.

## Chạy

Mint credential development do repository sở hữu, rồi decrypt record đã duyệt và viết env bridge bị ignore:

```powershell
npm run secret:gen -- dev
npm run sync
```

Lưu một value bên thứ ba qua hidden prompt. Không ghi `.stacks/` và `.enc`; tool tự thêm:

```powershell
npm run secret:set -- dev/runtime/files/<name>.key
```

Khi cùng value còn phải thành GitHub Actions secret, dùng publisher của Source. Tool chỉ in tên
environment variable và target. `--plan` không ghi gì; invocation apply đọc `<SECRET_NAME>` từ process
environment hiện tại nếu có, nếu không sẽ mở hidden prompt:

```powershell
node .claude/scripts/publish-secret.mjs --name <SECRET_NAME> --stack ".::<record-under-.stacks>" --repo <owner/repository> --plan
node .claude/scripts/publish-secret.mjs --name <SECRET_NAME> --stack ".::<record-under-.stacks>" --repo <owner/repository>
```

Không đặt value sau `--name`, trong generated command hay trong chat. Chỉ repeat `--repo` khi credential
của provider thật sự scoped organization/global; repository token chỉ ở một repository.

Với JSON credential đang nằm trong một file được bảo vệ:

```powershell
npm run secret:set -- dev/runtime/files/<name>.json --from-file <protected-path>
```

List tên mà không hiện value:

```powershell
npm run secret:list
```

`secret:show` decrypt ra file bị ignore và không in value. Xóa plaintext ngay khi consumer dùng xong:

```powershell
npm run secret:show -- dev/runtime/files/<name>.key
```

## Verify

```powershell
Test-Path .stacks\dev\runtime\files\<name>.key
Test-Path .stacks\dev\runtime\files\<name>.key.enc
git status --short
```

Plaintext check phải là `False`, encrypted check là `True`, và chỉ file `*.enc` chủ đích được stage.
`npm run sync` phải hoàn tất mà không publish value.

## Dừng hoặc rollback

Nếu encrypt lỗi, tool cố ý giữ plaintext để không làm mất value. Sửa SOPS, chạy lại, rồi chứng minh
plaintext đã biến mất. Nếu bỏ một record mới chưa commit, chỉ xóa đúng plaintext/encrypted target đã
verify; không bao giờ recursive-clear `.stacks`.

## Rotate

1. Issue replacement ở provider trước.
2. Replace fixed encrypted record bằng `secret:set`.
3. Replace mọi projection đang dùng nó (GitHub Secret, deployed secret store hoặc server file).
4. Verify value mới bằng thao tác không phá hủy.
5. Revoke token cũ ở provider sau cùng.

Credential bootstrap datastore (PostgreSQL, Elasticsearch và Keycloak admin) gắn với volume. Không
rotate riêng file của chúng; đi theo reset boundary trong Local stack.

## Troubleshoot

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| `sops is not installed` | `winget install Mozilla.SOPS` rồi mở shell mới |
| thiếu master identity | restore `%USERPROFILE%\.starci\master.identity` |
| no matching creation rule | chạy từ repo root và kiểm tra `.sops.yaml` |
| app vẫn đọc value cũ | chạy lại `npm run sync`; restart app/container |
| `compose` báo thiếu file | `npm run secret:gen -- dev`, rồi `npm run sync` |
| publisher báo không có interactive terminal | set named variable trong process đó hoặc chạy ở terminal interactive |
| một repository từ chối batch token | dùng token riêng của repository đó; không tự nới scope local |

## Upstream

- [SOPS](https://getsops.io/)
- [age](https://github.com/FiloSottile/age)
