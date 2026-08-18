---
title: Delivery assurance cloud
---

# Delivery assurance: Codecov và SonarQube Cloud

## Dùng khi

Dùng trang này để nối backend repository với Codecov Cloud và SonarQube Cloud, publish credential không
có plaintext, lấy pull request xanh đầu tiên rồi bắt buộc các check đó.

## Trước khi chạy

Local source gates phải pass trước. GitHub operator cần repository admin access, tài khoản Codecov và
SonarQube Cloud đã bind với GitHub organization, `gh` auth, SOPS và master identity.

```powershell
gh auth status
npm ci
npm run lint:check
npm run typecheck
npm run build
npm run test:ci
```

## Secrets

| Tên | Encrypted owner | GitHub projection |
|---|---|---|
| Codecov upload token | `.stacks/dev/runtime/files/codecov-token.key.enc` | secret `CODECOV_TOKEN` |
| Sonar analysis token | `.stacks/dev/runtime/files/sonarqube-token.key.enc` | secret `SONAR_TOKEN` |
| Sonar EU endpoint | không phải secret | variable `SONAR_HOST_URL=https://sonarcloud.io` |

## Chạy

### Codecov Cloud

1. Sign in bằng GitHub, cài Codecov GitHub App cho organization và grant repository này.
2. Mở setup page của repository và copy upload token.
3. In plan không có value, rồi lưu và project qua một hidden/process-env input:

```powershell
node .claude/scripts/publish-secret.mjs --name CODECOV_TOKEN --stack ".::dev/runtime/files/codecov-token.key" --repo starci-lab/starci-academy-backend --plan
node .claude/scripts/publish-secret.mjs --name CODECOV_TOKEN --stack ".::dev/runtime/files/codecov-token.key" --repo starci-lab/starci-academy-backend
```

4. Giữ `coverage/lcov.info`, `codecov/codecov-action@v5`, `fail_ci_if_error: true`, và project/patch status
blocking trong `codecov.yml`.

### SonarQube Cloud

1. Bind GitHub organization `starci-lab` và import repository.
2. Tắt Automatic Analysis; chế độ đó bỏ qua CI config này và không import coverage.
3. Chọn GitHub Actions/CI-based analysis.
4. Copy organization/project key thật từ Project Information vào `sonar-project.properties`:

```properties
sonar.organization=<actual-organization-key>
sonar.projectKey=<actual-project-key>
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

5. Tạo scoped organization token nếu plan hỗ trợ, nếu không thì personal analysis token.
6. In plan không có value, rồi lưu và project token:

```powershell
node .claude/scripts/publish-secret.mjs --name SONAR_TOKEN --stack ".::dev/runtime/files/sonarqube-token.key" --repo starci-lab/starci-academy-backend --plan
node .claude/scripts/publish-secret.mjs --name SONAR_TOKEN --stack ".::dev/runtime/files/sonarqube-token.key" --repo starci-lab/starci-academy-backend
gh variable set SONAR_HOST_URL --repo starci-lab/starci-academy-backend --body "https://sonarcloud.io"
```

7. Bảo đảm checkout full history và CI chỉ chạy đúng một coverage test trước Codecov/Sonar:

```yaml
with:
  fetch-depth: 0
```

Chỉ commit config và encrypted records, push non-main branch rồi mở pull request.

## Verify

```powershell
gh secret list --repo starci-lab/starci-academy-backend
gh variable list --repo starci-lab/starci-academy-backend
gh pr checks --watch
```

Pull request phải có `CI / verify`, Codecov project/patch statuses và SonarQube Code Analysis. Trong hai
provider dashboard, revision phải khớp pull request SHA và cả hai dùng cùng LCOV. Sau một run thành công,
cấu hình ruleset `main` require đúng context do GitHub App tương ứng phát ra. Phải quan sát check trước;
không tự đoán context name.

## Dừng hoặc rollback

Disable repository trong provider hoặc revoke token để dừng upload. Không bỏ branch protection trước khi
replacement check live; tạm rollback provider config và token cùng nhau.

## Rotate

Tạo provider token mới, replace encrypted record, replace GitHub Secret, chạy lại một PR, rồi revoke token
cũ. `SONAR_HOST_URL` chỉ đổi khi region/instance đổi.

## Troubleshoot

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| Codecov unauthorized | repository token và quyền repository của GitHub App |
| không có Codecov status | App đã cài và project/patch enabled trong `codecov.yml` |
| Sonar project not found | organization/project key thật từ Project Information |
| Sonar duplicate analysis | Automatic Analysis vẫn enabled |
| Sonar coverage bằng zero | `coverage/lcov.info` tồn tại trước scan và path không đổi |
| không chọn được required check | để đúng check đó complete trong repository trước |
| private repo không tạo được ruleset | nâng GitHub plan hoặc chuyển repository public |

## Upstream

- [Codecov Quick Start](https://docs.codecov.com/docs/quick-start)
- [Codecov Action](https://github.com/codecov/codecov-action)
- [SonarQube Cloud GitHub Actions](https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/ci-based-analysis/github-actions-for-sonarcloud)
- [SonarQube Cloud automatic-analysis limits](https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/automatic-analysis)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
