# starci-setup-sonar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng phê duyệt và đầu ra dùng chung |
| `@workspaces` | `knowledge/contexts/workspaces/vi.md` | vi | xác định mọi vai trò Source đã route |
| `@assurance-be` | `knowledge/compilers/patterns/be/delivery-assurance/vi.md` | vi | bằng chứng scanner, coverage và quality |
| `@assurance-fe` | `knowledge/compilers/patterns/fe/delivery-assurance/vi.md` | vi | bằng chứng frontend scanner, coverage và quality |
| `@sonar-assurance` | `runtime/machines/sonar-assurance/vi.md` | vi | máy gate nghiêm ngặt và ranh giới secret |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | reconcile hostname tường minh, an toàn giá trị |
| `@credential-bootstrap` | `scripts/sonar-source-credentials.mjs` | script | reconcile project, identity theo scope, record mã hóa và GitHub an toàn value phía sau Windows wrapper |

## NESTED SKILLS

None.

## PIPELINE

Topology: `reconciliation`.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| kiểm kê | dùng chung | mọi routed source role và declared shared Sonar service | resolve project keys, scanners, credentials và required quality metrics | Sonar desired-state matrix | mỗi backend, frontend và console role có một identity |
| kiểm kê-lập kế hoạch | reconciliation | desired matrix và current Docker/Sonar/project state | tính service, project, gate và badge deltas | reconciliation plan | strict overall/new-code requirements vẫn explicit |
| duyệt-thực thi | execution | approved plan và scoped authorities | reconcile shared service và project configuration | setup receipts | không lộ secret hay làm yếu quality gate |
| chứng minh | proof | fresh service, API và scan results | verify từng role và strict gate condition | Sonar readiness proof | service healthy và mọi required project gate measurable |

## Run

Xác minh mọi row route Source (`be`/backend, `fe`/frontend và console) rồi kiểm kê project. Dùng một Sonar service
`compose:starci` dùng chung với project key riêng. Nạp assurance để analysis dùng unit run và coverage
artifact đã đo. Plan chỉ local và không có giá trị nhạy cảm; chỉ execute tường minh mới reconcile
provider hoặc công bố hostname.

Đọc toàn bộ khai báo Sonar của từng repository đã route trước khi plan: `sonar-project.properties`,
scanner command trong manifest, LCOV path và CI reference. Mỗi route sở hữu một Sonar project và một
project-analysis service identity riêng; không bao giờ tái dùng admin token hoặc scanner token của route
khác. Khi execute đã được duyệt, tạo project/identity còn thiếu rồi bind identity vào encrypted record,
repository secret `SONAR_TOKEN` và variable `SONAR_HOST_URL` của chính route đó.
Với project private, còn tạo hoặc reuse badge token read-only riêng, scope theo project và chỉ đặt nó trên
official README badge image endpoint. Đây là capability cố ý public, không phải analysis/admin credential;
không bao giờ thay bằng scanner/admin token.

## Authority and secrets

Scanner token theo project và khác authority admin/operator. Analysis token dùng `SONAR_TOKEN` hoặc stdin; Execute cần `SONAR_ADMIN_TOKEN`. Token không qua argument hay log; thiếu status, SHA hoặc metric bắt buộc là fail. Plan và test không gọi bên ngoài.

Nếu thiếu operator authority, phải xin owner ngay, không đợi tới proof cuối. Chạy OS check kế thừa từ
`@skill-shape`, rồi chỉ trình wrapper không chứa value tương thích với host:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/set-sonar-credentials.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/set-sonar-credentials.ps1 -Execute
```

```sh
sh .claude/scripts/set-sonar-credentials.sh
sh .claude/scripts/set-sonar-credentials.sh --execute
```

Prompt execute nhận operator login/password cục bộ và ẩn, mint hoặc reuse admin API token riêng, mã hóa
nó, tạo mọi project còn thiếu, reconcile gate do `@sonar-assurance` khai báo, tạo/reuse một
project-analysis token cho mỗi
route, publish GitHub projection rồi xóa value khỏi process. Value trong chat không bao giờ là input. Chỉ
dùng `-Rotate` khi chủ đích rotate credential.

## Proof

Chứng minh đủ route, mỗi route có project-analysis identity riêng cùng encrypted/GitHub projection,
analysis SHA chính xác, gate OK, required findings bằng không, rating A, hotspots
đã xem 100%, duplicated density không quá 3, native coverage tối thiểu 80% tổng thể và 90% phần mới.
Chứng minh mọi README badge endpoint trả semantic SVG và badge token của project private là read-only,
scope theo project, đồng thời được redact khỏi output.

## Stops

- Dừng khi thiếu role, SHA thiếu hoặc lệch, required metric thiếu/lỗi, thiếu authority hoặc mở rộng phạm vi.

## Output

Báo cáo inventory, mode, bằng chứng, đường dẫn thay đổi và lệnh proof tập trung theo ngôn ngữ workspace.
