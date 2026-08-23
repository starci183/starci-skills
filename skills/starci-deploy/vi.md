---
title: StarCi deploy
---

# starci-deploy

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | contract approval, persistence và output dùng chung |
| `@initialization` | `readiness/initialization/vi.md` | vi | readiness identity, bootstrap, routed workspace và worktree |
| `@deployment` | `deployment/vi.md` | vi | luật manifest, `.infra`, setup, domain, deploy và monitor |
| `@deployment-plan` | `scripts/deployment-plan.mjs` | script | validate, plan và init deployment đã khai mà không chép logic manifest vào skill |

## NESTED SKILLS

Không có.

## PIPELINE

Topology: `reconciliation`.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| ràng buộc | dùng chung | roles đã verify, environment và durable `.stacks` intent | khóa release, host, domain và rollback ownership | deployment contract | mọi target đều declared và routable |
| kiểm kê-lập kế hoạch | đối chiếu | deployment contract và observed `.infra`/host/provider state | tính setup, release, migration và traffic deltas | execution plan và rollback point | destructive/external mutation vẫn cần approval |
| thực thi | execution | plan đã duyệt | reconcile infrastructure và immutable release, retry bước recoverable | release và operation receipts | chỉ target đã khai mutation, từng bước idempotent hoặc recoverable |
| trạng thái ổn định | proof | fresh public, host và service observations | monitor health, so desired với observed state | deployment proof hoặc rollback receipt | public steady state pass, nếu không thì recover hoặc rollback |

## Run

Đọc `@skill-shape`, `@initialization` và `@deployment` theo thứ tự đó. Resolve ngôn ngữ Source, project,
environment và owner role đã khai. Verify mọi role deployment gọi tên trước khi đọc target source. Giữ
nguyên existing change và không refresh source-context MCP.

Chạy `@deployment-plan` ở plan mode. Nếu `.stacks/deployment.json` chưa có, scan stack, workflow,
credential-by-name, runtime definition, probe và sibling precedent liên quan thật, rồi tạo đúng một manifest
và touch boundary chính xác. Không thay bằng generic example hoặc infer host/domain.

## Ngữ nghĩa invocation

Phân loại động từ của owner trước khi chọn path. `deploy`, `deploy VPS`, `deploy production`, `redeploy`,
`release`, `triển khai VPS` và imperative tương đương là execution intent, không phải yêu cầu giải thích hay
so sánh hạ tầng. Resolve project, role và environment từ request explicit, rồi active invocation envelope,
sau đó một verified workspace route cùng manifest không mơ hồ. Chỉ dừng nếu các evidence đó vẫn còn hơn một target.

Khi manifest đã resolve khai đủ host, runtime manager, artifact, domain và probe, invocation imperative chính
là release decision cho đúng declared boundary đó. In target đã resolve và value-free execution plan như notice,
rồi thực thi; không hỏi owner chọn Caddy, Docker, Swarm, Tunnel hay platform khác khi manifest đã chọn, không dừng
sau planning và không đòi thêm một `OK` chung chung. Sibling như Nivo có thể chứng minh stack pattern hoặc shared
ingress identity, nhưng không bao giờ trở thành deployment target, credential owner hay application được release.

## Frontend Next.js

Với từng Next.js artifact, đọc tường minh `frontend.layout`, `frontend.surface`, `frontend.buildContext`,
`frontend.dockerfile` và `frontend.stackDefinition` trong manifest; không infer repository layout từ sibling hay chỉ từ tên folder. `single-app`
nghĩa là một routed repository role sở hữu một deployed surface. `monorepo` có thể build nhiều surface artifact
từ một repository, nhưng mỗi surface giữ source root, Dockerfile, immutable image, runtime target, domain mapping
và health probe riêng. Dùng declared build context để workspace package còn available khi `next build`; ưu tiên
Next.js standalone production output trong runtime image khi product source hỗ trợ.

Tên surface là product-owned slug như `landing`, `app`, `crm`, `admin` hoặc tên đã khai khác. Hostname là product
decision độc lập cho từng artifact; không derive từ surface name, repository layout hay sibling project. Khi
adopt, hỏi owner hostname của từng surface trong một approval batch. Khi manifest hợp lệ đã khai mapping
artifact-to-domain, dùng lại mà không hỏi lần nữa. Monorepo có nhiều surface vẫn build/deploy artifact độc lập
và prove trusted HTTPS cho từng primary hostname đã khai.

Runtime declaration trên VPS của từng surface thuộc tracked boundary
`<stack.root>/frontend/<surface>/...` trong repository sở hữu manifest, ví dụ
`.stacks/vps/frontend/crm/stack.yml`. Khi adopt, tạo hoặc reconcile definition đó cùng manifest, service target,
immutable image và probe. Sau khi stack write đã duyệt pass validation, tiếp tục thẳng qua build, publication,
VPS rollout, domain/TLS reconciliation và steady-state proof trong cùng invocation. Chỉ tạo file `.stacks` chưa
phải là kết quả deployment.

## Approval boundary

Với adoption, manifest thiếu, target mơ hồ hoặc host/domain/tenant/project mới, hiển thị một plan không có value
dưới `### NEED APPROVALS`: tracked manifest/source write, routed repository chính xác, SSH host reference,
artifact target, domain name cùng owner/driver, workflow/ref, provider mutation và monitor success window.
`OK` authorize toàn bộ boundary mới đó đúng một lần.

Với imperative execution request có observed plan khớp chính xác manifest hợp lệ hiện có, hiển thị cùng các fact
như execution notice và tiếp tục ngay. Invocation đó authorize release operation và deployment-owned repair nhỏ
nhất trong declared repository; nó không authorize destructive data loss, credential rotation, product/business
expansion hay external boundary khác.

Sau `OK`, lấy baseline rồi tiếp tục setup, source wiring, `.infra` initialization, provider change, workflow
dispatch, SSH repair, retry và monitoring mà không hỏi về quyết định in-scope thông thường. Chỉ quay lại
approval khi có destructive data loss, credential rotation, hostname/tenant/project mới hoặc boundary khác
chưa hiển thị trong plan.

## Execute to outcome

Init `.infra` bằng `@deployment-plan --init`. Dùng script và workflow repository sở hữu thay vì viết lại.
Dùng SSH connector có sẵn để inspect và repair remote; nếu không có thì dùng OpenSSH đã verify, giữ credential
khỏi argument và output.

Với từng domain, chỉ chạy driver đã khai. Route `terraform` đổi qua product apply. Route
`cloudflare-tunnel` dùng `.claude/scripts/cloudflare-tunnel-set.mjs`; skill không nested nhau nhưng shared
helper value-safe được gọi trực tiếp. Luôn plan provider change trước và từ chối conflict.

Chạy verification trước release. Dispatch immutable release workflow đã khai, đợi completion, inspect bounded
remote evidence và public probe, repair owned failure nhỏ nhất và chỉ retry sau khi nguyên nhân đổi. Tiếp tục
tới khi mọi required probe giữ green suốt steady window của manifest.

Concrete release path theo declared source thay vì mở lại technology proposal: verify; build và publish immutable
container artifact khi đã khai; cài hoặc prove declared VPS runtime; deploy qua Compose, Swarm hay manager đã khai;
chạy migration/init job; reconcile domain driver đã khai; prove trusted TLS và application health đủ steady window.
Sau repair, quay lại stage nhỏ nhất đã fail thay vì khởi động lại hội thoại ở bước chọn architecture.

Apply, workflow hay container green chỉ là evidence trung gian, không phải terminal condition. Chỉ pause khi
vendor credential phải nhập qua hidden input, thiếu access, hoặc action tiếp theo vượt approved boundary. Không
bao giờ hỏi credential value trong chat.

## Monitor và output

Chỉ ghi value-free observation dưới `.infra/<environment>/monitor` đã ignored. Report tiến độ bằng ngôn ngữ
Source, không dùng status table: gate đang fail, evidence, repair và proof tiếp theo.

Completion gọi tên routed revision, immutable artifact identity, workflow conclusion, domain change,
SSH/runtime convergence, public steady-state probe và rollback identity. Không bao giờ in credential value,
provider response body hay remote log không giới hạn.
