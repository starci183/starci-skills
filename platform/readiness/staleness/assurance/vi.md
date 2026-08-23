---
title: Delivery assurance
---

# Delivery assurance

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@assurance-be` | `knowledge/compilers/patterns/be/delivery-assurance/vi.md` | vi | backend fence bảy phần có thẩm quyền |
| `@assurance-fe` | `knowledge/compilers/patterns/fe/delivery-assurance/vi.md` | vi | frontend fence bảy phần có thẩm quyền |
| `@stale-debts` | `platform/readiness/staleness/debts/vi.md` | vi | debt coverage/Sonar tạm thời có owner duyệt |

## Dấu hiệu stale

Backend và frontend assurance mặc định bắt buộc. Chỉ tracked `starci.deliveryAssurance.required: false` kèm `reason`
không rỗng mới cho verdict `not required`. Thiếu policy, `required: true`, hoặc false không reason vẫn là
required. Với mọi routed role required, thiếu hoặc không blocking một `ASSURANCE-*` fact đã chạm là stale; partial
adoption không phải profile nhỏ hơn.
Debt hợp lệ không biến assurance thành optional: fact ASSURANCE-3/4 được phủ mang verdict `debt`, threshold
và required check nghiêm vẫn giữ, delivery chỉ đi tiếp tới ngày hết hạn.

## README badge bắt buộc

Mọi backend hoặc frontend required phải có đủ bộ badge an toàn dưới đây trong README. Thiếu một badge vẫn là assurance
finding dù provider check đang xanh:

| Provider | Badge | Metric |
|---|---|---|
| Codecov | coverage | repository graph badge |
| SonarQube | quality gate | `alert_status` |
| SonarQube | coverage | `coverage` |
| SonarQube | bugs | `bugs` |
| SonarQube | vulnerabilities | `vulnerabilities` |
| SonarQube | code smells | `code_smells` |
| SonarQube | maintainability | `sqale_rating` |
| SonarQube | reliability | `reliability_rating` |
| SonarQube | security | `security_rating` |

Codecov dùng host `codecov.io` với path `/gh/<owner>/<repo>/graph/badge.svg`. SonarQube dùng
`<SONAR_HOST_URL>/api/project_badges/measure?project=<projectKey>&metric=<metric>`. Project public dùng URL
ảnh token-free. Project private chỉ được thêm `token` badge read-only, scope riêng cho project do provider
cấp khi provider bắt buộc, và chỉ trên official image endpoint đó. Capability này không được phép upload,
scan, gọi API hay quản trị. Mọi credential key khác, secret query opaque và badge token trên URL không phải
badge đều bị từ chối. Output của machine phải redact badge token. Mọi image endpoint phải trả SVG và mỗi
badge phải link đúng dashboard repository/project của provider.

## Evidence cho stale list

Đọc manifest policy trước. Với `not required`, report exact reason và dừng module. Nếu không, đọc
`@assurance-be` cho backend hoặc `@assurance-fe` cho frontend rồi chỉ inspect tên/wiring: Husky check-only pre-push, active PR CI, một unit LCOV producer,
Codecov consumer, Sonar scan cộng quality gate, fixed encrypted stack record, symbolic GitHub secret
reference, README badge an toàn cho Codecov cùng SonarQube quality gate, coverage, bugs,
vulnerabilities, code smells, maintainability, reliability, security, required check và deploy dependency.
Không decrypt credential. Provider value và required-check app binding giữ `unmeasured
external` nếu không có authorized API evidence.
Đọc debt record của role và hiện baseline cùng hạn cạnh fact coverage hoặc Sonar được phủ.

## Inventory cho repair

Chỉ chạy sau khi source gate xanh. Trình repository write tách external mutation: manifest/lockfile, hook,
workflow, coverage/provider config, encrypted record, provider project creation, GitHub Secrets/Variables
và required check. Hiện command `scripts/publish-secret.mjs --plan` không có value.

## Apply

Áp assurance pattern đã route thành một graph: local pre-push lint+unit; active PR CI có check-only lint,
typecheck/build và đúng một coverage run; một `coverage/lcov.info` cho Codecov lẫn Sonar; Codecov
project/patch cùng Sonar quality gate blocking; scanner có xác thực phải chạy từ checkout local hiện tại,
đợi và pass Sonar quality gate trước khi tin provider CI; encrypted stack custody và GitHub projection; README badge
an toàn và reachable cho Codecov cùng full SonarQube quality metric set; required check; mọi deploy hiện có phụ thuộc
verification. Repository không có deploy thì không invent.

Secret đến từ process env theo tên hoặc hidden input qua `scripts/publish-secret.mjs`; không qua chat,
stdout, command argument hay plaintext tracked file. Repository token chỉ target một repository trừ khi
provider thật sự cấp scope rộng hơn.

## Tách lane

Unit, E2E và Sonar giữ ownership riêng dù CI schedule chúng trong cùng workflow. Chỉ unit sinh
`coverage/lcov.info`; Sonar dùng unit artifact đó và loại file E2E khỏi scanner scope. E2E chỉ sở hữu behavior
end-to-end thật cùng test/pass count của chính nó. Workflow và proof machine phải giữ ba verdict độc lập:
E2E không được nâng hay thỏa Sonar coverage, còn Sonar không được thỏa hoặc miễn E2E. E2E làm thay đổi unit
coverage artifact là boundary violation stale.

## Thứ tự analysis local

Chỉ tin provider CI sau khi analysis local trên đúng checkout này đã đợi và pass quality gate. Ba sự kiện
quyết định điều đó có thật sự xảy ra hay không:

- **Scan không phải là gate.** Một run dừng ở "analysis uploaded" mới chỉ chứng minh server đã nhận
  report. `unmeasured` và `scan uploaded` là cùng một verdict, và không cái nào là `ready`. Quality gate
  báo `NONE` nghĩa là project chưa từng được analyse — chưa đo, không phải sạch.
- **Gate đỏ là source finding.** Phải sửa ở source rồi rescan cho tới khi xanh; đẩy sang CI là giấu nó
  đi chứ không phải xử lý nó.
- **E2E không phải Sonar coverage lane.** Chỉ unit sinh LCOV mà Sonar dùng. E2E chỉ sở hữu behavior
  end-to-end, bị loại khỏi Sonar analysis/coverage và không được mutate unit coverage artifact; E2E cùng
  Sonar giữ verdict độc lập.
- **Coverage luôn blocking và có bốn chiều.** Một unit run thành công phải chứng minh statements,
  functions và lines tối thiểu 80%, branches tối thiểu 75%, new-code/patch tối thiểu 90% cho từng metric.
  Phần trăm gộp, informational status hay provider badge không thay được bất kỳ fact nào. Cùng run đó sinh
  LCOV duy nhất cho Codecov và Sonar; provider gate native project/new coverage còn runner sở hữu bốn
  metric riêng. Mọi E2E lane đã khai báo cũng phải tìm thấy test thật, không skip và
  pass; lane rỗng hay cheaper substitute là stale.

- **Badge Sonar xanh không phải strict profile.** Analysis của đúng checkout phải trả gate `OK`,
  bugs/vulnerabilities/code smells bằng 0, hotspots reviewed 100%, ba rating A, duplicated-lines density
  ≤3% overall/new, native coverage >=80% overall và >=90% new. Thiếu API authority giữ các giá trị này
  `unmeasured external`; không biến chúng thành clean.

`@stale-debts` có thể tạm nhận project/patch coverage hoặc Sonar mà không đổi blocking profile, provider
check hay badge. Verdict là `debt`, không phải xanh; mọi fact ngoài debt vẫn blocking, debt sai/hết hạn fail closed.

**Emit bắt buộc của framework có thể mang ngưỡng branch riêng.** Khi một framework dependency injection
buộc phải có metadata mà runtime cần, compiler sinh ra guard không test nào chạm tới được — dưới
`emitDecoratorMetadata`, mỗi constructor parameter có kiểu đến từ value import sẽ emit
`typeof X !== "undefined" && X ? _a : Object`, và nhánh `Object` chết chừng nào module còn load được.
Statements, functions và lines không bị ảnh hưởng; chỉ branches bị nhiễm, và trần per-file
`(total − deps)/total` phạt nặng nhất service nhỏ có nhiều dependency.

Điều đó chỉ cho phép đúng một nhân nhượng, và nó rất hẹp:

- ngưỡng branch 75% được đặt **một lần, ở phạm vi toàn project, tại tầng analysis**, nơi artifact bị pha
  loãng trên toàn bộ bề mặt source và một thiếu hụt thật vẫn fail;
- nó **không bao giờ** là ignore per-file, `istanbul ignore`, coverage-path exclusion, hay hạ ngưỡng
  statement/function/line;
- khoảng cách giữa bar branch và ba metric kia phải được **ghi lại kèm nguyên nhân đã đo**, để người
  đọc phân biệt được artifact của framework với code chưa test;
- bar được **đặt theo bằng chứng, so với trần đã đo**, không phải làm tròn xuống cho vừa cái đang pass.
  Một ngưỡng chọn để chứa code chưa test là một gate bị bẻ.

Tắt metadata emit không phải lựa chọn: đó chính là metadata container đọc để resolve constructor
dependency, nên bỏ nó đi để làm đẹp con số là làm hỏng injection. Kiểm chứng một đòn bẩy bằng cách đo,
không phải bằng suy luận — `importHelpers` và coverage provider v8 đều trông như cách sửa, và cả hai đều
không làm con số nhúc nhích.

Các lane scanner song song không được dùng chung một binary cache; mỗi source một `SONAR_BINARY_CACHE`
riêng hoặc scan tuần tự. Không bao giờ xóa cache dùng chung để chữa triệu chứng trừ khi đã chứng minh
chính xác đường dẫn cache hỏng trước.

## Proof

Prove hook refuse controlled failure, exact CI graph, một LCOV dùng hai lần, local Sonar analysis từ checkout
hiện tại có waited quality gate `OK` sau mọi source repair và API evidence có xác thực, exact-SHA cho mọi
condition trong blocking quality profile, encrypted filename không có
plaintext twin, mọi badge image endpoint bắt buộc trả image và không dùng credential ngoài badge capability read-only được phép, external secret name/required
check qua API và deploy dependency. External enforcement hoặc badge endpoint chưa đo làm module chưa complete.
Debt còn hạn có thể cho delivery đi tiếp trong khi module vẫn incomplete và không ready.
