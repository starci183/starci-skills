---
title: Delivery assurance cloud
---

# Delivery assurance: Codecov và SonarQube dùng chung

## Dùng khi

Dùng trang này để nối một backend hoặc frontend repository với Codecov và SonarQube service dùng chung của
StarCi, publish credential không có plaintext, lấy pull request xanh đầu tiên rồi bắt buộc các check đó.

## Trước khi chạy

Local source gates phải pass trước, **và local Sonar quality gate phải xanh trước**. GitHub operator cần
repository admin access, tài khoản Codecov đã bind với GitHub organization, quyền truy cập SonarQube
service dùng chung, `gh` auth, SOPS và master identity.

```powershell
gh auth status
npm ci
npm run lint:check
npm run typecheck
npm run build
npm run test:ci
npm run sonar:check
```

`npm run sonar:check` không phải tùy chọn và không phải thủ tục cho có. Chỉ tin provider CI sau khi một
lần phân tích có xác thực trên đúng checkout hiện tại đã chờ và pass quality gate. Xem **Gate local trước
CI** bên dưới.

## Gate local trước CI

Scanner và quality gate là hai sự kiện khác nhau. Scanner upload thành công mới chỉ chứng minh SonarQube
đã nhận được report; nó chưa nói gì về việc code có pass hay không. Một run dừng ở "analysis uploaded"
phải coi là chưa đo, không bao giờ coi là sẵn sàng.

Thứ tự này bắt buộc cho mọi frontend hoặc backend được assure:

1. Local lint, typecheck, build và unit gates pass.
2. Sinh **đúng một** LCOV report. Chạy hai lần cho hai dashboard là drift, không phải assurance mạnh hơn.
3. Chạy phân tích Sonar có xác thực từ checkout hiện tại, trỏ vào service local.
4. Chờ quality gate — `sonar.qualitygate.wait=true` với timeout tối thiểu 600 giây.
5. Gate đỏ là **finding cần sửa ở source**, không phải lỗi provider và không phải chuyện của CI.
6. Sửa source rồi rescan cho tới khi gate xanh.
7. Chỉ khi đó mới tin hoặc chạy provider CI.

"Chưa đo" và "đã upload scan" đều không phải sẵn sàng. Gate đỏ đẩy sang CI là gate đỏ bị giấu, không phải
gate đỏ được xử lý.

Hai ràng buộc nữa luôn có hiệu lực mỗi khi phân tích chạy:

- **Cache scanner phải tách biệt.** Các lane chạy song song không được dùng chung một binary cache. Mỗi
  source một `SONAR_BINARY_CACHE` riêng, hoặc scan tuần tự. Không xóa cache `~/.sonar` dùng chung trừ khi
  đã chứng minh chính xác đường dẫn cache hỏng trước.
- **Coverage sẵn sàng là bốn con số, không phải một.** Statements, branches, functions và lines mỗi cái
  giữ ngưỡng độc lập. Một phần trăm gộp sẽ giấu đúng cái metric đang fail — thực tế branch coverage là
  cái tụt lại, và cũng là cái mà con số gộp che đi.

```powershell
$env:SOPS_AGE_KEY_FILE = "$HOME\.starci\master.identity"
$env:SONAR_HOST_URL    = "http://localhost:9011"
$env:SONAR_BINARY_CACHE = "$env:TEMP\sonarcache-<project>"
# decrypt field ["data"] thẳng vào process environment; không echo,
# không truyền làm command argument, không ghi vào file được track
npm run sonar:check
```

## Secrets

| Tên | Encrypted owner | GitHub projection |
|---|---|---|
| Codecov upload token | `.stacks/dev/runtime/files/codecov-token.key.enc` | secret `CODECOV_TOKEN` |
| Sonar analysis token (backend) | `.stacks/dev/runtime/files/sonarqube-token.key.enc` | secret `SONAR_TOKEN` |
| Sonar analysis token (một frontend) | `.stacks/dev/runtime/files/sonarqube-<project>-token.key.enc` | secret `SONAR_TOKEN` |
| Sonar endpoint | không phải secret | variable `SONAR_HOST_URL` |

Mỗi project có record token phân tích riêng, đặt tên theo project, để hai repository không ghi đè custody
của nhau. Service local và service publish là cùng một instance gọi bằng hai tên:
`http://localhost:9011` cho phân tích local, `https://sonar.starci.org` cho CI và cho README badge.

## Chạy

### Codecov

1. Sign in bằng GitHub, cài Codecov GitHub App cho organization và grant repository này.
2. Mở setup page của repository và copy upload token.
3. In plan không có value, rồi lưu và project qua một hidden/process-env input:

```powershell
node .claude/scripts/publish-secret.mjs --name CODECOV_TOKEN --stack ".::dev/runtime/files/codecov-token.key" --repo starci-lab/<repo> --plan
node .claude/scripts/publish-secret.mjs --name CODECOV_TOKEN --stack ".::dev/runtime/files/codecov-token.key" --repo starci-lab/<repo>
```

4. Giữ `coverage/lcov.info`, `codecov/codecov-action@v5`, `fail_ci_if_error: true`, và project/patch
status blocking trong `codecov.yml`. Nâng coverage target bằng cách cover thêm code, không bao giờ bằng
cách thêm exclusion.

### SonarQube

1. Xác nhận service dùng chung reachable và project key đã tồn tại. Onboard project mới là việc của
   `starci-setup-sonar`, không phải trang này.
2. Giữ project key trong `sonar-project.properties` và trỏ coverage vào đúng một LCOV report:

```properties
sonar.projectKey=<actual-project-key>
sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

3. Giữ `sonar.tests` và `sonar.test.inclusions` mô tả đúng các test suffix thật của repository. File test
   thuộc test surface, không thuộc source surface được phân tích; tách như vậy là đo cho đúng, không phải
   exclusion dùng để làm đẹp con số.
4. Tạo project analysis token, in plan không có value, rồi lưu và project token:

```powershell
node .claude/scripts/publish-secret.mjs --name SONAR_TOKEN --stack ".::dev/runtime/files/sonarqube-token.key" --repo starci-lab/<repo> --plan
node .claude/scripts/publish-secret.mjs --name SONAR_TOKEN --stack ".::dev/runtime/files/sonarqube-token.key" --repo starci-lab/<repo>
gh variable set SONAR_HOST_URL --repo starci-lab/<repo> --body "https://sonar.starci.org"
```

5. Bảo đảm checkout full history và CI chỉ chạy đúng một coverage test trước Codecov/Sonar:

```yaml
with:
  fetch-depth: 0
```

Chỉ commit config và encrypted records, push non-main branch rồi mở pull request.

## Verify

```powershell
gh secret list --repo starci-lab/<repo>
gh variable list --repo starci-lab/<repo>
gh pr checks --watch
```

Pull request phải có `CI / verify`, Codecov project/patch statuses và SonarQube quality gate. Trong hai
provider dashboard, revision phải khớp pull request SHA và cả hai dùng cùng LCOV. Sau một run thành công,
cấu hình ruleset `main` require đúng context do GitHub App tương ứng phát ra. Phải quan sát check trước;
không tự đoán context name.

Quality gate báo `NONE` nghĩa là project chưa từng được phân tích. Đó là chưa đo, không phải sạch, và nó
không bao giờ đủ để kết luận sẵn sàng.

## Dừng hoặc rollback

Disable repository trong provider hoặc revoke token để dừng upload. Không bỏ branch protection trước khi
replacement check live; tạm rollback provider config và token cùng nhau.

## Rotate

Tạo provider token mới, replace encrypted record, replace GitHub Secret, chạy lại một PR, rồi revoke token
cũ. `SONAR_HOST_URL` chỉ đổi khi instance hoặc tên public của nó đổi.

## Troubleshoot

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| Codecov unauthorized | repository token và quyền repository của GitHub App |
| không có Codecov status | App đã cài và project/patch enabled trong `codecov.yml` |
| Sonar project not found | project key thật từ Project Information |
| quality gate là `NONE` | project chưa từng được scan; chạy phân tích local trước |
| Sonar coverage bằng zero | `coverage/lcov.info` tồn tại trước scan và path không đổi |
| Sonar coverage lệch với test runner | runner đang gom coverage trên file mà Sonar xếp là test |
| hotspot API báo insufficient privileges | analysis token thiếu quyền hotspot; admin credential cấp được |
| các lane scanner phá nhau | hai lane dùng chung một `SONAR_BINARY_CACHE` |
| không chọn được required check | để đúng check đó complete trong repository trước |
| private repo không tạo được ruleset | nâng GitHub plan hoặc chuyển repository public |

## Upstream

- [Codecov Quick Start](https://docs.codecov.com/docs/quick-start)
- [Codecov Action](https://github.com/codecov/codecov-action)
- [SonarQube quality gates](https://docs.sonarsource.com/sonarqube-server/instance-administration/analysis-functions/quality-gates)
- [SonarScanner npm](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/sonarscanner-for-npm)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
