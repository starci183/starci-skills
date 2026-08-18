---
title: Repair source · Vietnamese
---

# starci-repair

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | module | cung cấp pattern backend đầy đủ cho hook, CI, coverage, analysis, secret và deploy |
| `@file-layout` | `compilers/patterns/fe/file-layout` | module | cung cấp vocabulary tier frontend đã được chấp nhận để repair structure |
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |

## NESTED SKILLS

Không có. Skill báo route stale rồi kết thúc; nó không tự chạy setup.

## Cách chạy

Đọc `@skill-shape` trước.

Tám thứ khác nhau đều thường bị gọi là stale:

| Thứ bị stale | Triệu chứng | Owner |
|---|---|---|
| **route** | checkout, contract hoặc head đã ghi không còn đúng | `starci-init` |
| **source** | build/lint fail hoặc format drift | skill này |
| **index** | gate xanh nhưng không tìm được contract `why` theo need | skill này, pass `why` |
| **machine** | lint package chưa cài hoặc checkout dùng bản vendored | skill này, trước khi đo |
| **formatter** | strict fix còn Prettier nằm cạnh ESLint canon đang sở hữu formatting | skill này, pass strict-fix |
| **assurance machine** | backend thiếu bất kỳ `ASSURANCE-*` phần nào: pre-push, PR CI, LCOV/Codecov, SonarQube gate, stack custody, required checks hay deploy dependency | skill này, assurance pass |
| **structure** | vocabulary đã bỏ một tier nhưng path vẫn còn, kể cả path rỗng mà gate theo file không thấy | skill này, pass retired-structure |
| **remnant** | target checkout còn `.claude/` từ tree cũ | skill này, sau index |

Phải resolve route trước và dừng nếu route mới là thứ stale. Sửa source qua route sai là sửa repository
không ai yêu cầu.

## Luật skill này bảo vệ

**Màu xanh phải được làm ra, không được mua bằng im lặng.** Finding phải được sửa hoặc trả lại; không dùng
`eslint-disable`, hạ severity, gỡ rule, skip test hay thêm `any` chỉ để gate xanh.

Formatting không phải repair. Behavioural fix bị chôn trong hàng nghìn dòng format sẽ không review được,
vì vậy đo, phân loại và sửa theo pass tách biệt. Approval khóa chính xác role, repository và boundary;
detection không cấp quyền ghi.

**Strict fix chỉ có một formatter: ESLint.** Khi request gọi strict fix, phải bỏ toàn bộ package trực tiếp,
plugin, shared config, config file, ignore file, script, hook, lint-staged, CI và editor integration của
Prettier. Entrypoint format còn cần dùng phải chuyển sang ESLint canon đã cài; lockfile được regenerate bằng
package manager, không sửa tay. Prettier chỉ còn do dependency không liên quan kéo gián tiếp thì báo đúng
dependency path, không tự xóa package ngoài boundary.

Gate xanh không chứng minh directory tree sạch. ESLint nhìn file và Git track file; directory cấm nhưng
rỗng thì cả hai đều không thấy. Repair phải inventory directory trực tiếp. `components/shells` vi phạm
`FILE-8` dù chứa bốn file hay không chứa file nào.

Backend assurance là complete hoặc stale. Đọc `@assurance-be` và cài đủ mọi situation đã chạm. Husky chỉ
là local refusal; active CI và required checks mới là merge fence. Codecov và SonarQube dùng chung một
LCOV report, deploy không được chạy đua với verification.

Token Codecov/SonarQube đi qua hidden-input stack-secret entrypoint thành
`.stacks/dev/runtime/files/codecov-token.key.enc` và `sonarqube-token.key.enc`; GitHub Actions nhận named
secret projection vì CI không giữ SOPS identity. Không hỏi value trong chat, không in, không commit
plaintext và không đặt value vào command-line argument.

## QUY TRÌNH

### 1 — Lập context lock

`Phase` là `repair`. `Touching` ban đầu là boundary được đề nghị; chưa approval thì không ghi product source.

### 2 — Resolve và kiểm tra route; route hỏng thì dừng

Đọc `.workspace/<project>/<role>/config.json`, kiểm tra checkout, contract và recorded head trước khi đọc
source. Mỗi lượt chỉ sửa một role của một project. Route stale kết thúc lượt chạy và owner row nêu hành
động tiếp theo.

### 3 — Đọc manifest trước khi chạy gì

Tìm package manager, scripts thật, Node/runtime requirement và gate repository công bố. Không tự bịa lệnh
chuẩn từ framework; chính manifest định nghĩa cách project đo mình.

Trong strict-fix mode, inventory package họ Prettier, `.prettierignore`, `.prettierrc*`,
`prettier.config.*`, manifest script, lint-staged, hook, CI và editor setting gọi hoặc chọn Prettier.
Inventory này là removal boundary và proof target.

Với backend, đọc `@assurance-be` rồi inventory manifest/lockfile, `.husky/`, CI/deploy workflow, coverage,
Codecov/SonarQube config, tên encrypted stack record, symbolic secret reference và required checks bên
ngoài. Không đọc secret value; external fact chưa có authorized API evidence phải ghi unmeasured.

### 4 — Kiểm tra machine trước khi tin count

Đọc manifest và lint config. Published lint packages phải được cài và config phải import chúng; folder
plugin hand-maintained hoặc mirror vendored nghĩa count đang đo bằng luật riêng. Sửa wiring trong pass
riêng, rồi mới lấy baseline.

### 5 — Đo và ghi lại con số

Chạy format-check, lint, typecheck, build và test đúng như repository khai. Ghi command, exit code và số
finding. Gate không chạy được phải thử hết fallback an toàn; không được coi là zero.

Format command dùng Prettier được đo một lần làm legacy evidence. Sau strict-fix pass, cùng script name
phải dùng ESLint hoặc bị bỏ nếu chỉ lặp lint gate; không giữ Prettier chỉ để chạy lại proof cũ.

Với frontend, đọc `@file-layout`, inventory mọi component root kể cả directory rỗng, rồi ghi path retired
tier, file count, tracked-file count và mọi import/export đi qua nó. Rule `no-shell-tier` giữ trường hợp có
file; inventory directory giữ trường hợp rỗng.

### 6 — Phân loại từng finding

Mỗi finding thuộc một nhóm: machine, strict-fix, format, mechanical, defect, index, assurance, retired-structure hoặc remnant. `strict-fix`
là mọi Prettier integration first-party và được sửa bằng cách bỏ trọn integration rồi để ESLint làm formatter duy nhất. Một dòng có thể cần
nhiều pass nhưng phải có một nguyên nhân gốc; không gom mọi thứ thành “lint debt”.

### 7 — Review count, classification và boundary

Đưa baseline, nhóm finding, file dự kiến chạm và thứ tự pass cho owner. `OK` duyệt mọi default cùng
boundary chính xác đã hiển thị; sau đó lấy baseline và bắt đầu Apply ngay. Nếu boundary phải rộng hơn,
quay lại review trước khi sửa.

Boundary strict fix gồm toàn bộ Prettier inventory, manifest và lockfile, đồng thời nêu format script nào
chuyển sang ESLint và script nào bị bỏ vì trùng. Reference phát hiện sau đó ở ngoài boundary phải quay lại
review, không được để removal dở dang.

Boundary assurance tách repository path khỏi external mutation. Phần repo có thể gồm manifest/lockfile,
`.husky/pre-push`, CI/deploy workflow, coverage/Codecov/SonarQube config, stack-secret tooling và encrypted
record. Phần external gọi tên project creation, GitHub Secrets/Variables và required checks nhưng không
hiện value. `OK` chỉ duyệt đúng service, repository và secret name đã hiển thị.

### 8 — Lấy baseline rồi sửa theo các pass tách biệt

Commit state trước thay đổi. Sửa machine trước; strict fix bỏ Prettier và regenerate lockfile; tiếp theo
format-only bằng ESLint, mechanical, defect, retired-structure, `why`, assurance cho backend, rồi remnant. Mỗi pass có diff đọc được và gate liên quan chạy lại. Directory rỗng
không có Git diff vẫn phải ghi path cùng before/after count trong kết quả.

### 9 — Fan out chỉ defect pass

Chỉ chia defect pass khi các file độc lập và boundary không overlap. Machine, strict-fix, format, assurance, retired-structure và index cần một sự
thật chung nên không fan out. Mỗi nhánh nhận file chính xác, finding chính xác và evidence phải trả về.

### 10 — Pass `why`: làm index tìm lại được

`why` là câu trả lời cho “khi nào cần entry này”, không phải mô tả business hay shape. Ưu tiên recorded
miss từ lookup thật hơn count. Sửa reason bị miss trước, rồi xử lý count; không đổi key hoặc class để làm
query khớp.

### 11 — Pass retired-structure: bỏ tier `shells`

Với mỗi `components/shells` trong boundary, đếm file recursively và hỏi Git file nào tracked. Directory
rỗng thì xóa và ghi before/after dù Git diff rỗng. Có file thật thì giữ behavior, đọc export, mechanic và
call site để chuyển sang tier `@file-layout` yêu cầu; fixed vendor mechanic trở thành named branch. Đổi
folder/export, import, barrel, test và contract reference cùng một lượt.

Không xóa component thật chỉ để path biến mất. Identity hoặc semantic name chưa đủ bằng chứng thì trả đúng
component đó thành `decision`, tiếp tục phần đã giải được và đưa phần chưa giải vào `NEED APPROVALS`.
Machine pass
phải chạy trước; consumer dùng mirror thì cài canon package và bỏ mirror, không sửa private rule copy.

Proof gồm search không còn `components/shells`, search không còn import `/shells/`, gate `no-shell-tier`
từ package đã cài và toàn bộ gate ban đầu.

### 12 — Assurance pass: cài trọn backend delivery fence

Chỉ chạy sau khi lint, typecheck/build và unit xanh. Cài Husky pre-push gọi `lint:check` cộng
`test:ci`/`test:unit`; bật PR CI check-only; sinh một `coverage/lcov.info` rồi đưa cùng report cho Codecov
và SonarQube; quality/status checks phải blocking. Đưa hai token qua hidden-input stack-secret vào fixed
encrypted path, project sang GitHub Secrets mà không in value, và đặt `SONAR_HOST_URL` bằng repository
variable trừ khi installation yêu cầu secret. CI không decrypt `.stacks`.

Required CI/Codecov/SonarQube checks và expected apps được cấu hình qua branch protection/ruleset sau
approval và khi có access. Mọi deploy hiện có phải phụ thuộc verification; repo không có deploy không tạo
dummy workflow. Thiếu external evidence nghĩa pass chưa complete, không phải permission để bỏ gate.

### 13 — Remnant pass: một Source không mang hai trust tree

Kiểm tra `.claude/` trong target checkout. Nếu chỉ là remnant rỗng hoặc generated đã được owner duyệt thì
loại khỏi target; nếu có tracked file hay nội dung thật, dừng pass và đưa inventory cho owner. Không xóa
một trust tree đang sống vì tên thư mục trông cũ.

### 14 — Chứng minh bằng đúng command ban đầu

Chạy lại chính các command baseline, cùng working directory và options. Báo before/after từng gate. Một
command khác rẻ hơn không chứng minh finding cũ đã hết.

Strict fix còn phải chứng minh: không còn tracked config/ignore của Prettier; không còn direct package họ
Prettier; không còn script, hook, lint-staged, CI hay editor setting first-party gọi/chọn Prettier; mọi
format command còn giữ đều resolve sang ESLint và pass. Search tracked tree không phân biệt hoa thường;
match chỉ còn trong lockfile phải được giải bằng dependency-path command. Match first-party mở lại pass.

Backend assurance còn phải chứng minh đủ bảy `ASSURANCE-*` fact, tách repository proof khỏi external proof.
Workflow local complete nhưng branch protection hoặc secret projection chưa được verify vẫn là incomplete.

### 15 — Đóng phase

Ghi applied revision, baseline commit, tracked diff và before/after bằng văn xuôi. Diff phải bằng đúng
production tree trong `git diff <baseline>`; proof chạy được là `own` và phải hoàn tất trong lượt.

## Điểm dừng

- Route stale → gọi tên field sai rồi kết thúc lượt chạy.
- Gate chỉ pass khi suppression → dừng; đây là điều skill tồn tại để từ chối.
- Lint rule mâu thuẫn canon đã chấp nhận rõ → machine stale và được repair adoption; chỉ dừng khi chính
  canon chưa xác định behavior.
- Tree dirty bởi việc không liên quan → dừng; mixed baseline không chứng minh gì.
- `.claude/` trong target có tracked file hoặc nội dung thật → dừng remnant pass và trả inventory.
- Strict fix còn reference Prettier first-party → chưa được đóng phase dù lint, typecheck và build xanh.
- Còn thiếu `ASSURANCE-*` fact → chưa được đóng assurance pass; thiếu access được trả dưới
  `NEED APPROVALS`, không biến Codecov/SonarQube/required checks thành optional.
- Token chỉ đến được qua chat, stdout, command-line argument hoặc plaintext tracked file → dừng secret
  handling và trả secure-input boundary.
- Boundary cần mở rộng → quay lại owner, không tự thêm path.

## ĐẦU RA

Nói before/after, path chính theo pass, backend assurance proof và external enforcement evidence bằng văn
xuôi ngắn. Không bao giờ đưa secret value vào output. Trước batch kế tiếp, kể finding còn nợ rồi sửa trong
cùng lượt. Chỉ kết thúc khi `own = 0` hoặc đang chờ quyết định, secure access hay boundary expansion thật
dưới `### NEED APPROVALS`.
