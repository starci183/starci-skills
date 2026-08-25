---
title: Triển khai
---

# Triển khai

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `platform/deployment/schema.json` | file | validate deployment intent bền vững của một environment |
| `@deployment-plan` | `scripts/deployment-plan.mjs` | script | resolve các role đã route và materialize execution root ignored, không có value |
| `@workspaces` | `knowledge/contexts/workspaces/vi.md` | vi | chứng minh mọi repository deployment gọi tên |
| `@worktrees` | `knowledge/contexts/worktrees/vi.md` | vi | tách intent bền vững khỏi execution state có thể dựng lại |

## Record

Module này biến intent `.stacks` của một project đã route thành một deployment lặp lại được: chuẩn bị
machine và provider boundary, reconcile domain đã khai, release artifact bất biến, quan sát runtime từ xa
và tiếp tục repair cho tới khi public boundary ổn định.

Framework là dùng chung; manifest thuộc product. Nivo và MiAmia có thể cùng chạy Docker Swarm và
Cloudflare mà không sao chép host, service, credential hay tenant ownership của nhau.

## Ba root

`.stacks` là intent bền vững. Nó giữ deployment manifest tracked, source provider/runtime, credential
roster và encrypted twin. Reviewer có thể không đồng ý với nó và Git giữ lại quyết định đó.

`.infra/<environment>` là execution state sinh ra trong routed repository sở hữu manifest. Nó có thể giữ
machine path đã resolve, Terraform working data, SSH control state, provider plan không có value và monitor
observation. Toàn bộ root phải ignored trước khi planner tạo một byte. Nó dựng lại được và không bao giờ giữ
quyết định committed hay credential plaintext.

`.claude/platform/deployment` là luật và schema dùng chung cấp Source. Nó biết shape được phép và refusal boundary,
không biết hostname, VPS address hay secret name của một product.

## Manifest

Một environment được khai tại `.stacks/deployment.json`, hợp lệ với `@schema`. Nó gọi tên:

- project, owner role và mọi routed role tham gia release;
- một topology root (`.stacks/dev`, `.stacks/vps` hoặc `.stacks/k8s`) và một execution root
  `.infra/<environment>` tương ứng;
- SSH host reference và source setup host đã khai;
- artifact bất biến và runtime target của chúng;
- metadata Next.js frontend tùy chọn trên từng artifact: repository layout, surface slug, build context,
  Dockerfile và stack definition của target topology đã track;
- từng public hostname, artifact mapping, primary status, ownership và đúng một domain driver;
- deploy workflow/ref cùng proof command hoặc endpoint;
- monitor interval, steady window, timeout và probe;
- chỉ credential reference, tuyệt đối không có value.

Manifest không được chứa absolute path hay `..`. Route file sở hữu machine path; deployment manifest luôn
portable.

## Situation codes

| Code | Situation | Required result |
|---|---|---|
| `DEPLOYMENT-1` | Project có stack intent deploy được | tracked manifest validate và mọi role route fresh |
| `DEPLOYMENT-2` | Cần execution state | `.infra/<environment>` ignored toàn bộ, init từ manifest và disposable |
| `DEPLOYMENT-3` | Host phải chạy stack | chứng minh SSH identity, host separation, tài nguyên, port và runtime manager trước apply |
| `DEPLOYMENT-4` | Runtime cần credential/config | reference đã khai resolve qua custody path hiện hữu của stack; không value nào vào manifest, chat hay argument |
| `DEPLOYMENT-5` | Public hostname được khai | owner và driver chỉ reconcile route đó, không bao giờ cả zone |
| `DEPLOYMENT-6` | Có yêu cầu release | verification pass trước khi apply artifact bất biến và infrastructure |
| `DEPLOYMENT-7` | Xuất hiện remote failure | monitor evidence chọn repair nhỏ nhất và chạy lại đúng proof đã fail |
| `DEPLOYMENT-8` | Apply trả success | public probe và runtime identity quan sát được giữ green hết steady window đã khai |
| `DEPLOYMENT-9` | Stack topology được chọn | local Compose dùng `.stacks/dev`, VPS Swarm/Compose dùng `.stacks/vps`, Kubernetes dùng `.stacks/k8s`; tên environment không bao giờ trở thành stack root |
| `DEPLOYMENT-10` | Next.js frontend được release | mỗi surface single-app hoặc monorepo resolve tới immutable artifact, runtime target, explicit domain và public proof riêng |
| `DEPLOYMENT-11` | Frontend surface được adopt vào target stack | runtime definition được track dưới `<stack.root>/frontend/<surface>` và cùng invocation tiếp tục tới public steady state |

## Planning và approval

Chạy planner trước mọi mutation:

```text
node .claude/scripts/deployment-plan.mjs --source <Source> --project <project> --owner-role <role> --environment <environment> --plan
```

Nếu manifest chưa có, scan `.stacks`, workflow, runtime definition, credential manifest, probe và sibling
precedent thật, rồi đề xuất đúng một manifest và write boundary chính xác. Không infer manifest rồi apply
ngay: chọn host, public hostname ownership và tenant inclusion là product decision.

Plan không có value cùng exact source, provider, host và public boundary là approval surface. Sau approval,
init execution state bằng cùng command với `--init` và tiếp tục mà không hỏi về setup, repair hay retry thông
thường.

## Execution intent

Yêu cầu imperative deploy, deploy VPS, release production, redeploy hoặc rollback là operation, không phải
architecture consultation. Resolve target theo thứ tự: project/role/environment explicit trong request, active
invocation envelope, rồi một verified workspace route không mơ hồ có manifest hợp lệ. Target chưa resolve hoặc có
nhiều target dừng trước external mutation; target rõ ràng không vòng sang stack dự án khác chỉ vì stack đó cấp
precedent.

Khi observed plan tương đương byte-for-boundary với manifest hợp lệ hiện có, imperative request chính là release
authorization cho host, artifact, domain, driver, workflow và steady window đã khai. Report các fact đó như
execution notice rồi chạy qua verification, immutable build/publication, runtime deployment, migration hoặc init,
domain reconciliation, trusted TLS và steady-state proof. Chỉ cần approval chung lần hai khi adopt intent còn thiếu
hoặc thêm host, hostname, tenant, project, destructive action hay credential rotation mới.

Declared runtime sở hữu mechanism. Docker Swarm vẫn là Docker Swarm, Compose vẫn là Compose, Kubernetes vẫn là
Kubernetes và shared ingress hiện có vẫn dùng chung trừ khi source intent được duyệt thay đổi. Sibling deployment
có thể cấp immutable implementation precedent; nó không chuyển ownership application, host, domain, credential
hay state.

## Frontend topology

Frontend artifact có thể khai `framework: nextjs`, layout `single-app` hoặc `monorepo`, product-owned surface slug,
build context, Dockerfile và stack definition chính xác. `single-app` cho phép một deployed surface trên mỗi routed
repository role. `monorepo` cho phép nhiều surface artifact từ một role, nhưng mỗi surface sở hữu source root,
immutable image, runtime target và public probe riêng. Build dùng declared context—thường là repository root với
workspace—để shared package vẫn available. Runtime packaging nên dùng Next.js standalone output khi product hỗ
trợ; manifest ghi source và target ownership, không đoán framework.

Surface và hostname độc lập. Các tên `landing`, `app`, `crm`, `admin` chỉ là ví dụ, không phải business vocabulary
hay DNS convention đóng. Mỗi frontend artifact map tới ít nhất một domain đã khai explicit; khi có alias phải chỉ
đúng một primary domain. Khi adopt hoặc surface còn thiếu domain, hỏi owner tất cả hostname còn thiếu trong cùng
một batch. Không infer root hostname, subdomain prefix hay shared routing từ repository layout. Manifest hợp lệ
hiện có sở hữu các decision đó và redeploy dùng lại mà không hỏi.

Mỗi frontend artifact gọi tên một `stackDefinition` dưới `<stack.root>/frontend/<surface>/...`. Với
`stack.root: .stacks/vps`, FE runtime ownership nằm dưới `.stacks/vps/frontend`; với Kubernetes nó nằm dưới
`.stacks/k8s/frontend`. Definition nằm trong routed repository sở hữu manifest dù build source ở FE role khác.
Adoption ghi hoặc reconcile manifest và runtime definition trong một approved boundary, validate rồi tiếp tục cùng
invocation qua immutable build, rollout, domain/TLS reconciliation và public steady state. Chỉ tạo tracked stack
scaffold chưa bao giờ là completion.

## Setup

Setup chứng minh mọi prerequisite thay vì tin vào sự tồn tại:

1. validate mọi route, source path và workflow manifest gọi tên;
2. chứng minh `.infra/<environment>` bị ignored;
3. chứng minh tool cần thiết và provider/registry access đã authenticate;
4. resolve credential name qua hidden/encrypted custody mechanism sẵn có của project;
5. dùng SSH connector nếu có, nếu không dùng OpenSSH đã verify, để inspect host đã khai;
6. chứng minh host khác mọi forbidden host reference, port available, tài nguyên đủ và runtime manager healthy;
7. chỉ apply setup script/template đã khai và chứng minh lại từ một SSH connection mới;
8. chạy repository-local verification trước external release.

Credential do vendor cấp còn thiếu chỉ được nhập qua hidden terminal hoặc authorized provider. Agent không
bao giờ hỏi value trong conversation. Credential hiện hữu không bị rotate chỉ vì setup run nhìn thấy nó.

## Domain drivers

Mỗi hostname có một owner (`platform`, `tenant` hoặc `shared`) và một driver:

- `terraform` — manifest trỏ tới product stack source sở hữu record và origin cùng nhau;
- `cloudflare-tunnel` — Source helper reconcile một remotely managed HTTP(S) tunnel ingress và proxied
  CNAME từ `.infra` plan đã resolve.

Deployment skill gọi driver hiện hữu. Nó không viết Cloudflare client thứ hai, sửa dashboard bằng tay hay
thay record xung đột. Wildcard cần tenant/shared ownership tường minh; platform record không được tiện tay
chiếm tenant space.

## Deploy loop

Verification gate chạy trước. Deploy dùng workflow/ref manifest khai và artifact tag hoặc digest bất biến.
Workflow đã khai có thể verify, build và publish artifact trước khi deploy. Nó không push hay merge source chỉ để
trigger workflow khi release mechanism hỗ trợ explicit dispatch.

Quan sát workflow và remote runtime. Khi fail, phân loại source, credential/config presence, provider access,
domain, SSH/host, runtime manager, rollout hoặc application health. Thu bounded evidence, repair owned boundary
nhỏ nhất, chạy lại narrow proof và chỉ retry khi nguyên nhân đã đổi.

Một apply fail không kết thúc run. External state không đổi không bị busy-retry. Mất dữ liệu destructive,
credential rotation, public/tenant boundary mới hay project khác phải quay lại approval.

## Monitoring

Monitoring kết hợp provider/workflow state, SSH runtime state và public probe manifest khai. Nó kiểm observed
artifact identity, service convergence, restart loop, bounded log, tài nguyên, listening port, TLS/DNS và
application-level readiness.

Monitor chỉ ghi observation không có value dưới `.infra/<environment>/monitor`. Deployment chỉ complete sau
khi mọi required probe giữ green suốt `steadySeconds`, trong `timeoutSeconds`. Terraform apply green hay một
container running riêng lẻ không phải success.

## Proof

`@deployment-plan --self-test` validate parser và security refusal mà không mutate filesystem hay external.
Một run thật còn phải chứng minh:

- mọi routed head và deployment source;
- ignored `.infra` ownership;
- credential name và custody, không phải value;
- SSH host/runtime readiness;
- exact domain driver result;
- verification và workflow conclusion;
- immutable artifact identity;
- public và remote monitor steady state;
- không còn plaintext/temp remnant.

## Rules

1. `.stacks` khai; `.infra` chạy; `.claude/platform/deployment` quản.
2. Không infer deployment path, hostname, address hay credential value từ sibling checkout.
3. `.infra` phải ignored toàn bộ trước khi tạo và luôn dựng lại được.
4. Credential value không bao giờ xuất hiện trong manifest, plan, chat, log hay command argument.
5. Một domain có một owner và driver đã khai; reconciliation không bao giờ mở rộng thành cả zone.
6. Verification đi trước deployment và immutable identity sống qua rollout lẫn rollback.
7. SSH/runtime evidence và public probe cùng tham gia completion.
8. Repair và retry tiếp tục tới steady success hoặc approval/input boundary thật.
9. Target topology và environment là hai chiều riêng. Theo shape họ MiAmia: local Compose nằm dưới
   `.stacks/dev`, VPS Swarm hoặc Compose dưới `.stacks/vps`, còn Kubernetes dưới `.stacks/k8s`.
   `production` và `staging` chỉ thuộc `manifest.environment` và `.infra/<environment>`;
   `.stacks/production`, `.stacks/staging` và mọi stack root suy ra từ environment đều invalid.
10. Imperative deploy request trên một manifest hợp lệ đã resolve phải thực thi release đó; planning là control
    trung gian và không bao giờ là terminal result.
11. Sibling precedent có thể cấp pattern nhưng không bao giờ đổi deployment target hoặc ownership đã resolve.
12. Frontend repository layout chỉ điều khiển build resolution; hostname từng surface là owner input explicit,
    không derive từ `single-app`, `monorepo` hay surface slug.
13. Frontend adoption ghi runtime dưới `<stack.root>/frontend/<surface>` và tiếp tục tới deployment; tạo source
    `.stacks` mà chưa prove release là chưa hoàn tất.

## Scope

Module này sở hữu deployment contract, generated execution boundary, setup, domain routing, release loop và
monitoring proof. Nó không chọn VPS, domain, tenant rollout policy, secret value hay application architecture
cho product.
