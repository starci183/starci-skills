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

## NESTED SKILLS

Không có.

## Run

Đọc `@skill-shape`, `@initialization` và `@deployment` theo thứ tự đó. Resolve ngôn ngữ Source, project,
environment và owner role đã khai. Verify mọi role deployment gọi tên trước khi đọc target source. Giữ
nguyên existing change và không refresh source-context MCP.

Chạy `@deployment-plan` ở plan mode. Nếu `.stacks/deployment.json` chưa có, scan stack, workflow,
credential-by-name, runtime definition, probe và sibling precedent liên quan thật, rồi tạo đúng một manifest
và touch boundary chính xác. Không thay bằng generic example hoặc infer host/domain.

## Approval boundary

Hiển thị một plan không có value dưới `### NEED APPROVALS`: tracked manifest/source write, routed repository
chính xác, SSH host reference, artifact target, domain name cùng owner/driver, workflow/ref, provider mutation
và monitor success window. `OK` authorize toàn bộ declared boundary đó đúng một lần.

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

Apply, workflow hay container green chỉ là evidence trung gian, không phải terminal condition. Chỉ pause khi
vendor credential phải nhập qua hidden input, thiếu access, hoặc action tiếp theo vượt approved boundary. Không
bao giờ hỏi credential value trong chat.

## Monitor và output

Chỉ ghi value-free observation dưới `.infra/<environment>/monitor` đã ignored. Report tiến độ bằng ngôn ngữ
Source, không dùng status table: gate đang fail, evidence, repair và proof tiếp theo.

Completion gọi tên routed revision, immutable artifact identity, workflow conclusion, domain change,
SSH/runtime convergence, public steady-state probe và rollback identity. Không bao giờ in credential value,
provider response body hay remote log không giới hạn.
